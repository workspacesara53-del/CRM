// @ts-nocheck
import { config } from "dotenv";
import path from "path";
import fs from "fs";
import http from "http"; // Added for health check
// Load environment variables with fallback
const envPath = fs.existsSync(path.join(process.cwd(), ".env.local"))
    ? path.join(process.cwd(), ".env.local")
    : path.join(process.cwd(), "../.env.local");
config({ path: envPath });
// ===== HEALTH CHECK SERVER FOR RENDER/RAILWAY =====
// This keeps the service alive and compliant with port binding requirements
const port = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('WhatsApp Worker is running!');
});
server.listen(port, () => {
    console.log(`[HealthCheck] Server is listening on port ${port}`);
});
// ==================================================
import { makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, downloadMediaMessage, Browsers } from "@whiskeysockets/baileys";
import { createHash } from "crypto";
import { supabaseAdmin } from "./lib/supabaseAdmin";
import pino from "pino";
import { callAI } from "./lib/ai-agent";
import { isPhoneJid, isLidJid, upsertChat, linkLidToPhone } from "./lib/chat-utils";
const sessions = new Map();
const syncedSessions = new Set();
const sessionChatJids = new Map();
const HISTORY_CHAT_LIMIT = 200;
const HISTORY_MESSAGE_LIMIT = 50;
const mediaPlaceholders = {
    image: "[image]",
    video: "[video]",
    audio: "[audio]",
    sticker: "[sticker]",
    document: "[document]",
};
function recordChatJid(sessionId, jid) {
    if (!jid || jid === "status@broadcast")
        return;
    const set = sessionChatJids.get(sessionId) || new Set();
    set.add(jid);
    sessionChatJids.set(sessionId, set);
}
function computeProviderId(params) {
    if (params.waMessageId)
        return params.waMessageId;
    const hash = createHash("sha1").update(params.body || "").digest("hex").slice(0, 10);
    return `fallback:${params.jid}:${params.timestamp}:${hash}:${params.fromMe ? "1" : "0"}`;
}
function parseMessageContent(msg) {
    let body = "";
    let mediaType = null;
    if (msg?.message?.conversation) {
        body = msg.message.conversation;
    }
    else if (msg?.message?.extendedTextMessage?.text) {
        body = msg.message.extendedTextMessage.text;
    }
    else if (msg?.message?.imageMessage) {
        body = msg.message.imageMessage.caption || mediaPlaceholders.image;
        mediaType = "image";
    }
    else if (msg?.message?.videoMessage) {
        body = msg.message.videoMessage.caption || mediaPlaceholders.video;
        mediaType = "video";
    }
    else if (msg?.message?.audioMessage) {
        body = msg.message.audioMessage.ptt ? mediaPlaceholders.audio : mediaPlaceholders.audio;
        mediaType = "audio";
    }
    else if (msg?.message?.stickerMessage) {
        body = mediaPlaceholders.sticker;
        mediaType = "sticker";
    }
    else if (msg?.message?.documentMessage) {
        const fileName = msg.message.documentMessage.fileName || mediaPlaceholders.document;
        body = `${mediaPlaceholders.document} ${fileName}`;
        mediaType = "document";
    }
    return { body, mediaType };
}
async function loadRecentMessages(sock, jid, limit) {
    try {
        if (typeof sock.loadMessages === "function") {
            const loaded = await sock.loadMessages(jid, limit);
            if (Array.isArray(loaded))
                return loaded;
        }
    }
    catch (err) {
        console.warn(`[HistorySync] loadMessages failed for ${jid}:`, err);
    }
    try {
        if (typeof sock.fetchMessagesFromWA === "function") {
            const loaded = await sock.fetchMessagesFromWA(jid, limit);
            if (Array.isArray(loaded))
                return loaded;
        }
    }
    catch (err) {
        console.warn(`[HistorySync] fetchMessagesFromWA failed for ${jid}:`, err);
    }
    try {
        const storeMessages = sock.store?.messages?.[jid] || sock.store?.messages?.get?.(jid);
        if (storeMessages && Array.isArray(storeMessages)) {
            return storeMessages.slice(-limit);
        }
    }
    catch (err) {
        console.warn(`[HistorySync] store lookup failed for ${jid}:`, err);
    }
    return [];
}
async function runHistorySync(sessionId, sock) {
    if (syncedSessions.has(sessionId))
        return;
    try {
        const cached = sessionChatJids.get(sessionId) || new Set();
        let chatIds = Array.from(cached);
        if (chatIds.length === 0 && sock.chats) {
            try {
                if (typeof sock.chats.all === "function") {
                    chatIds = (sock.chats.all() || []).map((c) => c.id).filter(Boolean);
                }
                else if (Array.isArray(sock.chats)) {
                    chatIds = sock.chats.map((c) => c.id || c.jid).filter(Boolean);
                }
            }
            catch (err) {
                console.warn(`[HistorySync] unable to read sock.chats for session ${sessionId}:`, err);
            }
        }
        const uniqueChatIds = Array.from(new Set(chatIds)).filter((jid) => jid && jid !== "status@broadcast");
        const recentChatIds = uniqueChatIds.slice(-HISTORY_CHAT_LIMIT);
        if (recentChatIds.length === 0) {
            console.log(`[HistorySync] session=${sessionId} chatsFetched=0 (skip)`);
            return;
        }
        syncedSessions.add(sessionId);
        console.log(`[HistorySync] session=${sessionId} chatsFetched=${recentChatIds.length}`);
        for (const jid of recentChatIds) {
            recordChatJid(sessionId, jid);
            const phoneJid = isPhoneJid(jid) ? jid : undefined;
            const { chat } = await upsertChat(sessionId, jid, phoneJid, {
                type: jid.endsWith("@g.us") ? "GROUP" : "INDIVIDUAL",
            });
            const messages = await loadRecentMessages(sock, jid, HISTORY_MESSAGE_LIMIT);
            let inserted = 0;
            let skipped = 0;
            for (const msg of messages) {
                const key = msg?.key || {};
                const remoteJid = key.remoteJid || jid;
                const fromMe = key.fromMe ?? false;
                const timestamp = typeof msg?.messageTimestamp === "number"
                    ? new Date(msg.messageTimestamp * 1000).toISOString()
                    : new Date().toISOString();
                const { body, mediaType } = parseMessageContent(msg);
                if ((!body || body.trim() === "") && !mediaType) {
                    skipped += 1;
                    continue;
                }
                const providerId = computeProviderId({
                    waMessageId: key.id,
                    jid: remoteJid,
                    timestamp,
                    body,
                    fromMe,
                });
                const { data: existing } = await supabaseAdmin
                    .from("messages")
                    .select("id")
                    .eq("session_id", sessionId)
                    .eq("provider_message_id", providerId)
                    .limit(1)
                    .maybeSingle();
                if (existing?.id) {
                    skipped += 1;
                    continue;
                }
                const { error: insertError } = await supabaseAdmin.from("messages").insert({
                    chat_id: chat.id,
                    session_id: sessionId,
                    remote_id: remoteJid,
                    sender: fromMe ? "agent" : "user",
                    body,
                    timestamp,
                    is_from_us: fromMe,
                    media_type: mediaType,
                    media_url: null,
                    status: fromMe ? "sent" : "delivered",
                    created_at: timestamp,
                    provider_message_id: providerId,
                });
                if (insertError) {
                    if (insertError.code === "23505") {
                        skipped += 1;
                        continue;
                    }
                    console.error(`[HistorySync] Failed inserting message for ${remoteJid}:`, insertError);
                    skipped += 1;
                    continue;
                }
                inserted += 1;
            }
            console.log(`[HistorySync] jid=${jid} messagesFetched=${messages.length} inserted=${inserted} skipped=${skipped}`);
        }
    }
    catch (err) {
        console.error(`[HistorySync] Error for session ${sessionId}:`, err);
    }
}
async function downloadAndUploadMedia(msg, mediaType, sessionId) {
    try {
        const buffer = await downloadMediaMessage(msg, "buffer", {}, {
            logger: pino({ level: "silent" }),
            reuploadRequest: () => Promise.resolve({})
        });
        if (!buffer)
            return null;
        console.log(`Media download successful for ${mediaType}, upload to Supabase Storage coming soon`);
        return null;
    }
    catch (error) {
        console.error("Error downloading/uploading media:", error);
        return null;
    }
}
async function startSession(sessionId) {
    if (sessions.has(sessionId)) {
        console.log(`Session already running, skipping: ${sessionId}`);
        return;
    }
    console.log(`Starting session ${sessionId}`);
    try {
        const { state, saveCreds } = await useMultiFileAuthState(`auth_info_baileys/${sessionId}`);
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: Browsers.ubuntu("Chrome"),
            syncFullHistory: true,
            defaultQueryTimeoutMs: undefined,
        });
        sessions.set(sessionId, sock);
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                console.log(`QR RECEIVED for session ${sessionId} len ${qr.length}`);
                try {
                    const { error } = await supabaseAdmin
                        .from("whatsapp_sessions")
                        .update({
                        qr: qr,
                        is_ready: false,
                        updated_at: new Date().toISOString()
                    })
                        .eq("id", sessionId);
                    if (error)
                        console.error(`Error updating whatsapp_sessions with QR for ${sessionId}:`, error);
                    else
                        console.log(`?o. QR Code for session ${sessionId} successfully updated`);
                }
                catch (e) {
                    console.error(`Error updating QR for ${sessionId}:`, e);
                }
            }
            if (connection === "close") {
                const isLoggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
                console.log(`Connection closed for ${sessionId}. Logged out: ${isLoggedOut}`);
                sessions.delete(sessionId);
                syncedSessions.delete(sessionId);
                sessionChatJids.delete(sessionId);
                if (isLoggedOut) {
                    console.log(`Session ${sessionId} logged out. Clearing all chats and restarting...`);
                    try {
                        await supabaseAdmin.from("chats").delete().eq("session_id", sessionId);
                        await supabaseAdmin.from("messages").delete().eq("session_id", sessionId);
                        await supabaseAdmin
                            .from("whatsapp_sessions")
                            .update({
                            is_ready: false,
                            qr: "",
                            should_disconnect: false,
                            updated_at: new Date().toISOString()
                        })
                            .eq("id", sessionId);
                        setTimeout(() => startSession(sessionId), 2000);
                    }
                    catch (e) {
                        console.error(`Error handling logout for ${sessionId}:`, e);
                    }
                }
                else {
                    console.log(`Connection error for ${sessionId}, reconnecting...`);
                    startSession(sessionId);
                }
            }
            else if (connection === "open") {
                console.log(`Session ${sessionId} connected.`);
                try {
                    await supabaseAdmin
                        .from("whatsapp_sessions")
                        .update({
                        is_ready: true,
                        qr: "",
                        updated_at: new Date().toISOString()
                    })
                        .eq("id", sessionId);
                    console.log(`Fetching chats for session ${sessionId}...`);
                    try {
                        const groups = await sock.groupFetchAllParticipating();
                        const groupIds = Object.keys(groups);
                        console.log(`Found ${groupIds.length} group chats`);
                        for (const chatId of groupIds) {
                            const chat = groups[chatId];
                            try {
                                recordChatJid(sessionId, chatId);
                                await supabaseAdmin
                                    .from("chats")
                                    .upsert({
                                    id: chatId,
                                    session_id: sessionId,
                                    remote_id: chatId,
                                    name: chat.subject || chat.id,
                                    type: "GROUP",
                                    is_group: true,
                                    last_message_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString()
                                }, { onConflict: "id" });
                            }
                            catch (e) {
                                console.error(`Error saving group chat ${chatId}:`, e);
                            }
                        }
                    }
                    catch (e) {
                        console.log(`Could not fetch groups:`, e);
                    }
                    await runHistorySync(sessionId, sock);
                    console.log(`Finished loading chats for session ${sessionId}`);
                }
                catch (e) {
                    console.error(`Error updating connected status for ${sessionId}:`, e);
                }
            }
        });
        sock.ev.on("creds.update", saveCreds);
        // =========================
        // Chats sync (initial + updates)
        // =========================
        sock.ev.on("chats.set", async ({ chats: waChats }) => {
            console.log(`[Worker:ChatsSet] Received ${waChats.length} chats for session ${sessionId}`);
            for (const waChat of waChats) {
                try {
                    const jid = waChat.id;
                    if (!jid || jid === "status@broadcast")
                        continue;
                    recordChatJid(sessionId, jid);
                    const isGroup = jid.endsWith("@g.us");
                    const phoneJidParam = isPhoneJid(jid) ? jid : undefined;
                    const { body: lastMessage } = parseMessageContent(waChat.lastMessage?.message ? waChat.lastMessage : { message: waChat.lastMessage });
                    await upsertChat(sessionId, jid, phoneJidParam, {
                        type: isGroup ? "GROUP" : "INDIVIDUAL",
                        name: waChat.name || waChat.subject || jid.split("@")[0],
                        lastMessage,
                    });
                }
                catch (e) {
                    console.error(`[Worker:ChatsSet] Error saving chat ${waChat.id}:`, e);
                }
            }
            await runHistorySync(sessionId, sock);
        });
        sock.ev.on("chats.upsert", async (waChats) => {
            for (const waChat of waChats) {
                try {
                    const jid = waChat.id;
                    if (!jid || jid === "status@broadcast")
                        continue;
                    recordChatJid(sessionId, jid);
                    const isGroup = jid.endsWith("@g.us");
                    const phoneJidParam = isPhoneJid(jid) ? jid : undefined;
                    await upsertChat(sessionId, jid, phoneJidParam, {
                        type: isGroup ? "GROUP" : "INDIVIDUAL",
                        name: waChat.name || waChat.subject || jid.split("@")[0],
                    });
                }
                catch (e) {
                    console.error(`[Worker:ChatsUpsert] Error saving chat ${waChat.id}:`, e);
                }
            }
        });
        // =========================
        // History sync events
        // =========================
        sock.ev.on("messaging-history.set", async ({ chats: historyChats = [], messages: historyMessages = [], isLatest }) => {
            console.log(`[HistorySet] chats=${historyChats.length} messages=${historyMessages.length} isLatest=${isLatest}`);
            const lastByChat = new Map();
            for (const chat of historyChats) {
                const jid = chat.id;
                if (!jid || jid === "status@broadcast")
                    continue;
                const isGroup = jid.endsWith("@g.us");
                const phoneJidParam = isPhoneJid(jid) ? jid : undefined;
                const name = chat.name ||
                    chat.subject ||
                    chat.pushName ||
                    chat.pushname ||
                    jid.split("@")[0];
                try {
                    await upsertChat(sessionId, jid, phoneJidParam, {
                        type: isGroup ? "GROUP" : "INDIVIDUAL",
                        name,
                    });
                }
                catch (err) {
                    console.error(`[HistorySet] Error upserting chat ${jid}:`, err);
                }
            }
            for (const msg of historyMessages || []) {
                try {
                    if (!msg?.message || !msg?.key?.remoteJid)
                        continue;
                    const jid = msg.key.remoteJid;
                    if (jid === "status@broadcast")
                        continue;
                    const timestamp = typeof msg.messageTimestamp === "number"
                        ? new Date(msg.messageTimestamp * 1000).toISOString()
                        : new Date().toISOString();
                    const { body, mediaType } = parseMessageContent(msg);
                    if (!body && !mediaType)
                        continue;
                    const providerId = computeProviderId({
                        waMessageId: msg.key.id,
                        jid,
                        timestamp,
                        body,
                        fromMe: msg.key.fromMe ?? false,
                    });
                    const { data: existing } = await supabaseAdmin
                        .from("messages")
                        .select("id")
                        .eq("session_id", sessionId)
                        .eq("provider_message_id", providerId)
                        .limit(1)
                        .maybeSingle();
                    if (existing?.id)
                        continue;
                    const fromMe = msg.key.fromMe ?? false;
                    const phoneJidParam = isPhoneJid(jid) ? jid : undefined;
                    const { chat } = await upsertChat(sessionId, jid, phoneJidParam, {
                        type: jid.endsWith("@g.us") ? "GROUP" : "INDIVIDUAL",
                    });
                    const { error: insertError } = await supabaseAdmin.from("messages").insert({
                        chat_id: chat.id,
                        session_id: sessionId,
                        remote_id: jid,
                        sender: fromMe ? "agent" : "user",
                        body,
                        timestamp,
                        is_from_us: fromMe,
                        media_type: mediaType,
                        media_url: null,
                        status: fromMe ? "sent" : "delivered",
                        created_at: timestamp,
                        provider_message_id: providerId,
                    });
                    if (insertError) {
                        if (insertError.code !== "23505") {
                            console.error(`[HistorySet] Insert error for ${jid}:`, insertError);
                        }
                        continue;
                    }
                    const prev = lastByChat.get(chat.id);
                    if (!prev || new Date(timestamp).getTime() > new Date(prev.ts).getTime()) {
                        lastByChat.set(chat.id, { body, ts: timestamp });
                    }
                }
                catch (err) {
                    console.error(`[HistorySet] Error processing history message:`, err);
                }
            }
            for (const [chatId, data] of lastByChat.entries()) {
                try {
                    await supabaseAdmin
                        .from("chats")
                        .update({
                        last_message: data.body,
                        last_message_at: data.ts,
                        updated_at: new Date().toISOString(),
                    })
                        .eq("id", chatId);
                }
                catch (err) {
                    console.error(`[HistorySet] Error updating chat last_message for ${chatId}:`, err);
                }
            }
        });
        // =========================
        // INCOMING / UPSERT EVENTS
        // =========================
        sock.ev.on("messages.upsert", async (m) => {
            console.log("messages.upsert", JSON.stringify(m, null, 2));
            if (m.type === "notify" || m.type === "append") {
                for (const msg of m.messages) {
                    if (!msg.message)
                        continue;
                    const jid = msg.key.remoteJid;
                    if (!jid || jid === "status@broadcast")
                        continue;
                    recordChatJid(sessionId, jid);
                    const fromMe = msg.key.fromMe ?? false;
                    const timestamp = typeof msg.messageTimestamp === "number"
                        ? new Date(msg.messageTimestamp * 1000).toISOString()
                        : new Date().toISOString();
                    const parsed = parseMessageContent(msg);
                    let body = parsed.body;
                    let mediaType = parsed.mediaType;
                    let mediaUrl = null;
                    if (msg.message?.imageMessage) {
                        mediaUrl = await downloadAndUploadMedia(msg, "image", sessionId);
                    }
                    else if (msg.message?.videoMessage) {
                        mediaUrl = await downloadAndUploadMedia(msg, "video", sessionId);
                    }
                    else if (msg.message?.audioMessage) {
                        mediaUrl = await downloadAndUploadMedia(msg, "audio", sessionId);
                    }
                    else if (msg.message?.stickerMessage) {
                        mediaUrl = await downloadAndUploadMedia(msg, "sticker", sessionId);
                    }
                    else if (msg.message?.documentMessage) {
                        mediaUrl = await downloadAndUploadMedia(msg, "document", sessionId);
                    }
                    if (!mediaType && (!body || body.trim() === "")) {
                        console.log(`[Worker:Incoming] skip empty message provider=${msg.key.id} fromMe=${fromMe}`);
                        continue;
                    }
                    const providerId = computeProviderId({
                        waMessageId: msg.key.id,
                        jid,
                        timestamp,
                        body,
                        fromMe,
                    });
                    try {
                        const isPhone = isPhoneJid(jid);
                        const isLid = isLidJid(jid);
                        console.log(`[Worker:Incoming] sessionId=${sessionId}, jid=${jid}, fromMe=${fromMe}, provider=${providerId}`);
                        const { data: existing } = await supabaseAdmin
                            .from("messages")
                            .select("id")
                            .eq("session_id", sessionId)
                            .eq("provider_message_id", providerId)
                            .limit(1)
                            .maybeSingle();
                        if (existing?.id) {
                            console.log(`[Worker:Incoming] Duplicate skipped provider_message_id=${providerId}`);
                            continue;
                        }
                        if (fromMe) {
                            const tsDate = new Date(timestamp);
                            const tsMillis = isNaN(tsDate.getTime()) ? Date.now() : tsDate.getTime();
                            const windowStartIso = new Date(tsMillis - 5 * 60 * 1000).toISOString();
                            const { data: pendingRow } = await supabaseAdmin
                                .from("messages")
                                .select("id, chat_id, body, created_at, status, remote_id")
                                .eq("session_id", sessionId)
                                .eq("is_from_us", true)
                                .is("provider_message_id", null)
                                .in("status", ["pending", "sent"])
                                .eq("body", body)
                                .gte("created_at", windowStartIso)
                                .order("created_at", { ascending: false })
                                .limit(1)
                                .maybeSingle();
                            if (pendingRow?.id) {
                                const { error: pendingUpdateError } = await supabaseAdmin
                                    .from("messages")
                                    .update({
                                    provider_message_id: providerId,
                                    status: "sent",
                                    remote_id: jid,
                                    timestamp,
                                    created_at: timestamp,
                                })
                                    .eq("id", pendingRow.id);
                                if (pendingUpdateError) {
                                    if (pendingUpdateError.code === "23505") {
                                        console.log(`[Worker:Incoming] Duplicate pending row already updated provider_message_id=${providerId}`);
                                        continue;
                                    }
                                    console.error(`[Worker:Incoming] Error updating pending message ${pendingRow.id}:`, pendingUpdateError);
                                }
                                else {
                                    const { data: pendingChat } = await supabaseAdmin
                                        .from("chats")
                                        .select("id, phone_jid, remote_id")
                                        .eq("id", pendingRow.chat_id)
                                        .single();
                                    const phoneJid = pendingChat?.phone_jid ||
                                        (pendingChat && isPhoneJid(pendingChat.remote_id) ? pendingChat.remote_id : undefined);
                                    if (isLid && phoneJid) {
                                        await linkLidToPhone(sessionId, jid, phoneJid);
                                        console.log(`[Worker:Incoming] Linked LID ${jid} to phone ${phoneJid} via pending message ${pendingRow.id}`);
                                    }
                                    console.log(`[Worker:Incoming] fromMe reconciled provider=${providerId} pending=${pendingRow.id} chat=${pendingRow.chat_id} remote=${jid}`);
                                    continue;
                                }
                            }
                        }
                        const phoneJidParam = isPhone ? jid : undefined;
                        const { chat } = await upsertChat(sessionId, jid, phoneJidParam, {
                            type: "INDIVIDUAL",
                            lastMessage: body,
                        });
                        console.log(`[Worker:Incoming] chat.id=${chat.id} remote_id=${chat.remote_id} providerId=${providerId} fromMe=${fromMe}`);
                        const { data: insertedMessage, error: msgError } = await supabaseAdmin
                            .from("messages")
                            .insert({
                            chat_id: chat.id,
                            session_id: sessionId,
                            remote_id: jid,
                            sender: fromMe ? "agent" : "user",
                            body,
                            timestamp,
                            is_from_us: fromMe,
                            media_type: mediaType,
                            media_url: mediaUrl,
                            status: fromMe ? "sent" : "delivered",
                            created_at: timestamp,
                            provider_message_id: providerId,
                        })
                            .select("id")
                            .single();
                        if (msgError) {
                            if (msgError.code === "23505") {
                                console.log(`[Worker:Incoming] Duplicate blocked by unique index: ${providerId}`);
                                continue;
                            }
                            console.error(`[Worker:Incoming] Error inserting message:`, msgError);
                            continue;
                        }
                        console.log(`[Worker:Incoming] Saved message=${insertedMessage?.id} provider=${providerId}`);
                        await supabaseAdmin
                            .from("chats")
                            .update({
                            last_message: body,
                            last_message_at: timestamp,
                            unread_count: fromMe ? chat.unread_count : (chat.unread_count || 0) + 1,
                            updated_at: new Date().toISOString(),
                        })
                            .eq("id", chat.id);
                        console.log(`[Worker:Incoming] SUCCESS msg=${insertedMessage?.id} wa=${providerId}`);
                        // ========= AI LOGIC =========
                        if (!fromMe && body && body.trim() !== "") {
                            try {
                                const { data: chatData } = await supabaseAdmin
                                    .from("chats")
                                    .select("mode, unread_count, bot_id")
                                    .eq("id", chat.id)
                                    .single();
                                const customerServiceKeywords = [
                                    'عايز اكلم خدمة العملاء',
                                    'حولني خدمة العملاء',
                                    'اكلم خدمة العملاء',
                                    'موظف',
                                    'عايز موظف',
                                    'تحويل خدمة العملاء',
                                    'اتكلم مع موظف',
                                    'عايز اتكلم مع شخص',
                                ];
                                const messageText = (body || '').toLowerCase().trim();
                                const requestsHuman = customerServiceKeywords.some(keyword => messageText.includes(keyword.toLowerCase()));
                                if (requestsHuman) {
                                    await supabaseAdmin.from("chats").update({
                                        mode: "human",
                                        needs_human: true,
                                    }).eq("id", chat.id);
                                    const confirmationMessage = "تم تحويلك إلى خدمة العملاء. سيقوم أحد موظفينا بالرد عليك قريباً.";
                                    // send confirmation
                                    await sock.sendMessage(jid, { text: confirmationMessage });
                                }
                                else if (chatData?.mode === "human") {
                                    console.log(`[AI] human mode, skip`);
                                }
                                else {
                                    const { data: messagesHistory } = await supabaseAdmin
                                        .from("messages")
                                        .select("body, sender")
                                        .eq("chat_id", chat.id)
                                        .order("created_at", { ascending: false })
                                        .limit(6);
                                    const conversationHistory = (messagesHistory || [])
                                        .reverse()
                                        .slice(0, -1)
                                        .map((msg) => ({
                                        role: msg.sender === "agent" ? "assistant" : "user",
                                        content: msg.body || "",
                                    }))
                                        .filter((m) => m.content.trim() !== "");
                                    const botId = chatData?.bot_id || undefined;
                                    const aiResponse = await callAI(conversationHistory, body, {
                                        botId,
                                        chatId: chat.id
                                    });
                                    // Reply via WhatsApp
                                    await sock.sendMessage(jid, { text: aiResponse.reply });
                                    if (aiResponse.handoff) {
                                        await supabaseAdmin.from("chats").update({
                                            mode: "human",
                                            needs_human: true,
                                            updated_at: new Date().toISOString(),
                                        }).eq("id", chat.id);
                                    }
                                }
                            }
                            catch (aiError) {
                                console.error(`[AI] error:`, aiError);
                            }
                        }
                    }
                    catch (e) {
                        console.error(`[Worker:Incoming] Error processing message:`, e);
                    }
                }
            }
        });
    }
    catch (error) {
        console.error(`Error starting session ${sessionId}:`, error);
        sessions.delete(sessionId);
    }
}
console.log("Starting Worker with Supabase...");
// Polling for pending messages
const sendingMessages = new Set();
console.log("[Worker] Setting up polling for pending messages (every 3 seconds)...");
setInterval(async () => {
    try {
        const { data: pendingMessages, error } = await supabaseAdmin
            .from("messages")
            .select("*")
            .eq("status", "pending")
            .limit(10);
        if (error) {
            console.error("[Polling] Error fetching pending messages:", error);
            return;
        }
        if (pendingMessages && pendingMessages.length > 0) {
            for (const messageData of pendingMessages) {
                // Simple logic from old worker
                const { id, session_id, remote_id, body } = messageData;
                if (sendingMessages.has(id))
                    continue;
                if (sessions.has(session_id)) {
                    sendingMessages.add(id);
                    const sock = sessions.get(session_id);
                    try {
                        await sock.sendMessage(remote_id, { text: body || "" });
                        await supabaseAdmin
                            .from("messages")
                            .update({ status: "sent" })
                            .eq("id", id);
                    }
                    catch (e) {
                        console.error("Failed to send message", e);
                        await supabaseAdmin
                            .from("messages")
                            .update({ status: "failed" })
                            .eq("id", id);
                    }
                }
            }
        }
    }
    catch (e) {
        console.error("[Polling] Error in message polling loop:", e);
    }
}, 3000);
// Polling for sessions (new/disconnect)
console.log("[Worker] Setting up polling for sessions (every 5 seconds)...");
setInterval(async () => {
    try {
        const { data: allSessions } = await supabaseAdmin.from("whatsapp_sessions").select("*");
        if (!allSessions)
            return;
        for (const sessionData of allSessions) {
            const { id: sessionId, should_disconnect } = sessionData;
            if (should_disconnect && sessions.has(sessionId)) {
                console.log(`Disconnecting session ${sessionId}`);
                const sock = sessions.get(sessionId);
                sock.logout();
                sessions.delete(sessionId);
                try {
                    // cleanup
                    fs.rmSync(path.join(process.cwd(), "auth_info_baileys", sessionId), { recursive: true, force: true });
                }
                catch { }
                await supabaseAdmin.from("whatsapp_sessions").delete().eq("id", sessionId);
            }
            else if (!sessions.has(sessionId) && !should_disconnect) {
                startSession(sessionId);
            }
        }
    }
    catch (e) {
        console.error("Session polling error", e);
    }
}, 5000);
// Keep alive
process.on("SIGINT", () => {
    console.log("Shutting down...");
    sessions.forEach((sock) => sock.end(undefined));
    process.exit(0);
});
