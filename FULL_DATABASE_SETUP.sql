-- ============================================
-- WA CRM - FULL DATABASE SETUP SCRIPT
-- ============================================
-- Run this script in your Supabase SQL Editor
-- This will create all necessary tables, indexes, and constraints.

-- 1. WhatsApp Sessions
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE, -- for backward compatibility if needed, but 'id' is preferred
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    qr TEXT,
    has_qr BOOLEAN DEFAULT false,
    qr_length INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'disconnected' CHECK (status IN ('connecting', 'connected', 'disconnected')),
    is_ready BOOLEAN DEFAULT false,
    should_disconnect BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Contacts
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_jid TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bots
CREATE TABLE IF NOT EXISTS public.bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    personality TEXT NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 1000,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Chats
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
    remote_id TEXT NOT NULL, -- The WhatsApp JID (phone or LID)
    phone_jid TEXT, -- Original phone JID if remote_id is LID
    name TEXT,
    bot_id UUID REFERENCES public.bots(id) ON DELETE SET NULL,
    type VARCHAR(20) DEFAULT 'INDIVIDUAL' CHECK (type IN ('INDIVIDUAL', 'GROUP')),
    status VARCHAR(20) DEFAULT 'INBOX' CHECK (status IN ('INBOX', 'DONE', 'ARCHIVED')),
    is_unread BOOLEAN DEFAULT false,
    last_message TEXT,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    unread_count INTEGER DEFAULT 0,
    avatar TEXT,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_group BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT true,
    is_muted BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    mode VARCHAR(10) DEFAULT 'ai' CHECK (mode IN ('ai', 'human')),
    needs_human BOOLEAN DEFAULT false,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, remote_id)
);

-- 5. Messages
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
    remote_id TEXT NOT NULL, -- Sender/Receiver JID
    sender TEXT NOT NULL, -- 'agent' or 'user' or JID
    body TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    is_from_us BOOLEAN DEFAULT false,
    media_type VARCHAR(20) CHECK (media_type IN ('image', 'video', 'audio', 'document', 'sticker')),
    media_url TEXT,
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'pending', 'failed')),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Admin/Agent who sent it
    wa_message_id TEXT UNIQUE, -- Provider ID from WhatsApp
    from_role VARCHAR(10) CHECK (from_role IN ('agent', 'user')),
    direction VARCHAR(10) CHECK (direction IN ('incoming', 'outgoing')),
    type VARCHAR(20) DEFAULT 'text',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Bot Knowledge Base
CREATE TABLE IF NOT EXISTS public.bot_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID REFERENCES public.bots(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100),
    keywords TEXT[],
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Canned Responses
CREATE TABLE IF NOT EXISTS public.canned_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    shortcut VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100),
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, shortcut)
);

-- 8. Campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed')),
    target_audience VARCHAR(100),
    recipients_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Campaign Recipients
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. JID Mappings (for LID/Phone tracking)
CREATE TABLE IF NOT EXISTS public.jid_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
  lid_jid TEXT NOT NULL,
  phone_jid TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, lid_jid)
);

-- 11. Team Members
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, added_by)
);

-- 12. Agent Stats
CREATE TABLE IF NOT EXISTS public.agent_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_chats INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    avg_response_time INTEGER DEFAULT 0,
    customer_satisfaction DECIMAL(2,1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- 📈 Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chats_session_id ON public.chats(session_id);
CREATE INDEX IF NOT EXISTS idx_chats_remote_id ON public.chats(remote_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON public.messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_wa_id ON public.messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_canned_responses_user ON public.canned_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_jid_mappings_phone ON public.jid_mappings(phone_jid);

-- 🚀 Disable RLS for easy initial setup (You can enable it later for production security)
ALTER TABLE public.whatsapp_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_knowledge DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.canned_responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.jid_mappings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_stats DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 🚀 MANUAL STEPS (Supabase Dashboard)
-- ============================================
-- 1. Create a Storage Bucket named 'chat-media'
--    - Set it to PUBLIC
--    - Allow authenticated/anonymous uploads (optional, depends on your security)
-- 2. Enable Realtime for tables: chats, messages, whatsapp_sessions

-- ============================================
-- 📊 RPC FUNCTIONS (For Analytics)
-- ============================================

-- Function to increment campaign sent count
CREATE OR REPLACE FUNCTION increment_campaign_sent(campaign_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.campaigns
  SET sent_count = sent_count + 1,
      updated_at = NOW()
  WHERE id = campaign_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to increment campaign failed count
CREATE OR REPLACE FUNCTION increment_campaign_failed(campaign_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.campaigns
  SET failed_count = failed_count + 1,
      updated_at = NOW()
  WHERE id = campaign_id_param;
END;
$$ LANGUAGE plpgsql;
