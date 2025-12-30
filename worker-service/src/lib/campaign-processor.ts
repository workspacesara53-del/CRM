import { supabaseAdmin } from './supabaseAdmin';
import { Campaign } from './types';

/**
 * Processes campaigns that are scheduled or currently sending.
 * This should be called periodically by the main worker.
 * 
 * @param sessions Map of active WhatsApp sessions (Baileys sockets)
 */
export async function processCampaigns(sessions: Map<string, any>) {
    try {
        const now = new Date().toISOString();

        // 1. Move scheduled campaigns to sending if it's time
        const { data: scheduledCampaigns, error: schedError } = await supabaseAdmin
            .from('campaigns')
            .select('*')
            .eq('status', 'scheduled')
            .lte('scheduled_at', now);

        if (schedError) {
            console.error('[Campaigns] Error fetching scheduled campaigns:', schedError);
        } else if (scheduledCampaigns && scheduledCampaigns.length > 0) {
            for (const campaign of scheduledCampaigns) {
                console.log(`[Campaigns] Starting scheduled campaign: ${campaign.name} (${campaign.id})`);
                await supabaseAdmin
                    .from('campaigns')
                    .update({ status: 'sending', updated_at: now })
                    .eq('id', campaign.id);
            }
        }

        // 2. Process campaigns in 'sending' status
        const { data: sendingCampaigns, error: sendError } = await supabaseAdmin
            .from('campaigns')
            .select('*')
            .eq('status', 'sending');

        if (sendError) {
            console.error('[Campaigns] Error fetching sending campaigns:', sendError);
            return;
        }

        if (!sendingCampaigns || sendingCampaigns.length === 0) return;

        for (const campaign of sendingCampaigns) {
            // 2.1. Check if we need to populate recipients
            const { count: recCount, error: countError } = await supabaseAdmin
                .from('campaign_recipients')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', campaign.id);

            if (countError) {
                console.error(`[Campaigns] Error counting recipients for ${campaign.id}:`, countError);
                continue;
            }

            if (recCount === 0) {
                console.log(`[Campaigns] Populating recipients for campaign: ${campaign.id}`);
                await populateRecipients(campaign);
                // Refresh campaign data after population
                continue;
            }

            // 2.2. Get next batch of pending recipients
            const { data: pendingRecipients, error: pendingError } = await supabaseAdmin
                .from('campaign_recipients')
                .select('*')
                .eq('campaign_id', campaign.id)
                .eq('status', 'pending')
                .limit(10); // Batch size

            if (pendingError) {
                console.error(`[Campaigns] Error fetching pending recipients for ${campaign.id}:`, pendingError);
                continue;
            }

            if (!pendingRecipients || pendingRecipients.length === 0) {
                // If no pending, mark campaign as completed
                console.log(`[Campaigns] Completing campaign: ${campaign.id}`);
                await supabaseAdmin
                    .from('campaigns')
                    .update({
                        status: 'completed',
                        completed_at: now,
                        updated_at: now
                    })
                    .eq('id', campaign.id);
                continue;
            }

            // 2.3. Identify active session for this user
            const { data: userSession } = await supabaseAdmin
                .from('whatsapp_sessions')
                .select('id')
                .eq('owner_id', campaign.user_id)
                .eq('is_ready', true)
                .limit(1)
                .maybeSingle();

            if (!userSession || !sessions.has(userSession.id)) {
                console.warn(`[Campaigns] No active session found for user ${campaign.user_id} to process campaign ${campaign.id}`);
                continue;
            }

            const sock = sessions.get(userSession.id);

            // 2.4. Send to the batch
            for (const rec of pendingRecipients) {
                const { data: chat } = await supabaseAdmin
                    .from('chats')
                    .select('remote_id')
                    .eq('id', rec.chat_id)
                    .single();

                if (!chat) {
                    await supabaseAdmin
                        .from('campaign_recipients')
                        .update({ status: 'failed', error_message: 'Chat not found' })
                        .eq('id', rec.id);
                    continue;
                }

                try {
                    console.log(`[Campaigns] Sending message to ${chat.remote_id} for campaign ${campaign.id}`);
                    await sock.sendMessage(chat.remote_id, { text: campaign.message });

                    await supabaseAdmin
                        .from('campaign_recipients')
                        .update({ status: 'sent', sent_at: new Date().toISOString() })
                        .eq('id', rec.id);

                    // Simple increment update
                    await supabaseAdmin.rpc('increment_campaign_sent', { campaign_id_param: campaign.id });

                } catch (err: any) {
                    console.error(`[Campaigns] Failed to send to ${chat.remote_id}:`, err);
                    await supabaseAdmin
                        .from('campaign_recipients')
                        .update({
                            status: 'failed',
                            error_message: err.message || 'Unknown error'
                        })
                        .eq('id', rec.id);

                    await supabaseAdmin.rpc('increment_campaign_failed', { campaign_id_param: campaign.id });
                }

                // Throttle to avoid rate limiting / spam detection
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    } catch (e) {
        console.error('[Campaigns] Unhandled error in processCampaigns:', e);
    }
}

async function populateRecipients(campaign: Campaign) {
    try {
        // Find session(s) owned by the user
        const { data: sessions } = await supabaseAdmin
            .from('whatsapp_sessions')
            .select('id')
            .eq('owner_id', campaign.user_id) as { data: { id: string }[] | null };

        if (!sessions || sessions.length === 0) {
            console.warn(`[Campaigns] No sessions found for user ${campaign.user_id} to populate recipients`);
            return;
        }

        const sessionIds = (sessions || []).map((s: { id: string }) => s.id);

        // Base query for chats
        let query = supabaseAdmin
            .from('chats')
            .select('id')
            .in('session_id', sessionIds)
            .eq('type', 'INDIVIDUAL');

        // Apply filters based on target_audience
        if (campaign.target_audience === 'new') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            query = query.gte('created_at', sevenDaysAgo.toISOString());
        } else if (campaign.target_audience === 'inactive') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            query = query.lte('last_message_at', thirtyDaysAgo.toISOString());
        }
        // 'all' doesn't need extra filter
        // 'vip' could be added if we have a way to identify them (e.g. tag_id)

        const { data: chats, error } = await query as { data: { id: string }[] | null, error: any };

        if (error) {
            console.error(`[Campaigns] Error fetching target chats for ${campaign.id}:`, error);
            return;
        }

        if (!chats || chats.length === 0) {
            console.log(`[Campaigns] No target recipients found for campaign: ${campaign.id}`);
            await supabaseAdmin
                .from('campaigns')
                .update({ status: 'completed', recipients_count: 0 })
                .eq('id', campaign.id);
            return;
        }

        const recipients = (chats || []).map((chat: { id: string }) => ({
            campaign_id: campaign.id,
            chat_id: chat.id,
            status: 'pending'
        }));

        // Insert in chunks if there are many
        const chunkSize = 100;
        for (let i = 0; i < recipients.length; i += chunkSize) {
            const chunk = recipients.slice(i, i + chunkSize);
            const { error: insertError } = await supabaseAdmin.from('campaign_recipients').insert(chunk);
            if (insertError) {
                console.error(`[Campaigns] Error inserting recipient chunk:`, insertError);
            }
        }

        await supabaseAdmin
            .from('campaigns')
            .update({ recipients_count: recipients.length })
            .eq('id', campaign.id);

        console.log(`[Campaigns] Populated ${recipients.length} recipients for campaign ${campaign.id}`);
    } catch (e) {
        console.error('[Campaigns] Error in populateRecipients:', e);
    }
}
