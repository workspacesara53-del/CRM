'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Chat, Message } from '@/lib/types';
import { dedupeMessages, upsertMessage } from '@/lib/message-utils';
import { Card } from "@/components/ui/card";
import ChatList from "@/components/chat/chat-list";
import ChatWindow from "@/components/chat/chat-window";
import ContactDetails from "@/components/chat/contact-details";
import NewChatModal from "@/components/chat/new-chat-modal";
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Loader2, Globe, Inbox } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const dynamic = 'force-dynamic';

export default function ChatPage() {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [allSessions, setAllSessions] = useState<{ id: string; name?: string }[]>([]);
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [jidMappings, setJidMappings] = useState<Record<string, string>>({});

  const applyMappingsToChats = (items: Chat[] | null, mappings: Record<string, string>) => {
    if (!items) return items;
    return items.map((chat: Chat) => {
      const remote = chat.remote_id || chat.remoteId;
      const currentPhone = chat.phone_jid || chat.phoneJid;
      if (!currentPhone && remote && mappings[remote]) {
        return { ...chat, phone_jid: mappings[remote] } as Chat;
      }
      return chat;
    });
  };

  useEffect(() => {
    const initUser = async () => {
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();

        if (authSession?.user) {
          setUserId(authSession.user.id);
        } else {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          setUserId(data.session?.user.id || null);
        }
      } catch (error) {
        console.error('Error initializing user:', error);
      }
    };

    initUser();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchSessions = async () => {
      try {
        const { data, error } = await (supabase
          .from('whatsapp_sessions')
          .select('id, session_id')
          .eq('owner_id', userId) as any);

        if (error) throw error;

        if (data && (data as any[]).length > 0) {
          const sessionsData = data as any[];
          setAllSessions(sessionsData.map((d: any) => ({ id: d.id, name: d.session_id })));
          const lastSessionId = localStorage.getItem(`last_session_${userId}`);
          if (lastSessionId && sessionsData.find((d: any) => d.id === lastSessionId)) {
            setSessionId(lastSessionId);
          } else {
            setSessionId(sessionsData[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching sessions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, [userId]);

  const handleSessionChange = (id: string) => {
    setSessionId(id);
    if (userId) localStorage.setItem(`last_session_${userId}`, id);
    setSelectedChatId(null);
    setChats(null);
    setMessages([]);
  };

  useEffect(() => {
    if (!sessionId) return;

    const fetchMappings = async () => {
      try {
        const { data, error } = await supabase
          .from('jid_mappings')
          .select('lid_jid, phone_jid')
          .eq('session_id', sessionId);
        if (error) throw error;
        const nextMap: Record<string, string> = {};
        (data || []).forEach((row: any) => {
          nextMap[row.lid_jid] = row.phone_jid;
        });
        setJidMappings(nextMap);
      } catch (err) {
        console.error('Error fetching jid_mappings:', err);
      }
    };

    fetchMappings();

    const mappingsChannel = supabase
      .channel(`jid_mappings-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jid_mappings',
        filter: `session_id=eq.${sessionId}`,
      }, (payload: RealtimePostgresChangesPayload<any>) => {
        setJidMappings((prev: Record<string, string>) => {
          const copy = { ...prev };
          const lid = (payload.new as { lid_jid?: string })?.lid_jid || (payload.old as { lid_jid?: string })?.lid_jid;
          const phone = (payload.new as { phone_jid?: string })?.phone_jid;
          if (payload.eventType === 'DELETE' && lid) {
            delete copy[lid];
          } else if (lid && phone) {
            copy[lid] = phone;
          }
          return copy;
        });
      })
      .subscribe();

    return () => { mappingsChannel.unsubscribe(); };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const fetchChats = async () => {
      setChatsLoading(true);
      try {
        const { data, error } = await supabase
          .from('chats')
          .select('*')
          .eq('session_id', sessionId)
          .order('last_message_at', { ascending: false });

        if (error) throw error;
        setChats(applyMappingsToChats(data || [], jidMappings));
      } catch (error) {
        console.error('Error fetching chats:', error);
        setChats([]);
        toast({
          title: 'خطأ في تحميل المحادثات',
          description: 'فشل تحميل المحادثات. حاول تحديث الصفحة.',
          variant: 'destructive',
        });
      } finally {
        setChatsLoading(false);
      }
    };

    fetchChats();

    const channel = supabase
      .channel(`chats-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chats',
        filter: `session_id=eq.${sessionId}`,
      }, (payload: RealtimePostgresChangesPayload<Chat>) => {
        if (payload.eventType === 'INSERT') {
          setChats((prev: Chat[] | null) => {
            const mapped = applyMappingsToChats([payload.new as Chat], jidMappings)?.[0] as Chat;
            if (!prev) return [mapped];
            return [mapped, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          setChats((prev: Chat[] | null) => {
            if (!prev) return prev;
            const mapped = applyMappingsToChats([payload.new as Chat], jidMappings)?.[0] as Chat;
            const updated = prev.map((c: Chat) => (c.id === (payload.new as any).id ? mapped : c));
            return updated.sort((a: Chat, b: Chat) => {
              const dateA = new Date(a.last_message_at || 0).getTime();
              const dateB = new Date(b.last_message_at || 0).getTime();
              return dateB - dateA;
            });
          });
        } else if (payload.eventType === 'DELETE') {
          setChats((prev: Chat[] | null) => {
            if (!prev) return prev;
            return prev.filter((c: Chat) => c.id !== (payload.old as any).id);
          });
        }
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [sessionId]);

  useEffect(() => {
    if (chats) {
      setChats(applyMappingsToChats(chats, jidMappings));
    }
  }, [jidMappings]);

  useEffect(() => {
    if (!sessionId || !selectedChatId) return;

    setMessagesLoading(true);

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', selectedChatId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(dedupeMessages(data || []));
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setMessagesLoading(false);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`messages-${selectedChatId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${selectedChatId}`,
      }, (payload: RealtimePostgresChangesPayload<Message>) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setMessages((prev: Message[]) => upsertMessage(prev, payload.new as Message));
        } else if (payload.eventType === 'DELETE') {
          setMessages((prev: Message[]) => prev.filter((msg: Message) => msg.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [sessionId, selectedChatId]);

  useEffect(() => {
    if (!selectedChatId && chats && chats.length > 0) setSelectedChatId(chats[0].id);
  }, [chats, selectedChatId]);

  const selectedChat = useMemo(
    () => (chats || []).find((c: Chat) => c.id === selectedChatId) || null,
    [chats, selectedChatId]
  );

  const handleNewChat = () => setNewChatModalOpen(true);

  const handleSendMessage = async (data: { phone: string; jid: string; message: string }) => {
    const clientRequestId = crypto.randomUUID();
    const response = await fetch('/api/messages/manual-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        to: data.jid,
        text: data.message,
        assignedTo: userId || null,
        clientRequestId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'فشل إرسال الرسالة');
    }

    const result = await response.json();
    setSelectedChatId(result.chatId);

    toast({ title: 'تم إرسال الرسالة', description: 'تم إنشاء المحادثة بنجاح' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-4 text-lg">جاري تحميل محادثاتك...</p>
      </div>
    );
  }

  if (!sessionId && allSessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-2xl font-bold mb-2">لم يتم ربط حساب WhatsApp</h2>
        <p className="text-muted-foreground">
          يرجى الذهاب إلى صفحة <a href="/connect" className="text-primary underline">ربط WhatsApp</a> لمسح QR والبدء.
        </p>
      </div>
    );
  }

  return (
    <>
      <NewChatModal
        open={newChatModalOpen}
        onOpenChange={setNewChatModalOpen}
        onSendMessage={handleSendMessage}
        sessionId={sessionId || ''}
      />

      <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-[#f0f2f5] dark:bg-[#111b21]">
        {/* Sidebar */}
        <div className="w-full md:w-[30%] lg:w-[25%] flex flex-col bg-white dark:bg-[#111b21] border-r dark:border-[#2f3b43]">
          {/* Session Switcher */}
          {allSessions.length > 1 && (
            <div className="p-3 border-b bg-muted/30">
              <Select value={sessionId || ''} onValueChange={handleSessionChange}>
                <SelectTrigger className="w-full bg-white dark:bg-[#202c33]">
                  <Globe className="h-4 w-4 ml-2 text-primary" />
                  <SelectValue placeholder="اختر حساب الواتساب" />
                </SelectTrigger>
                <SelectContent>
                  {allSessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name || `حساب ${s.id.slice(0, 5)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <ChatList
            chats={chats}
            selectedChatId={selectedChatId}
            onSelectChat={setSelectedChatId}
            onNewChat={handleNewChat}
          />
        </div>

        {/* Main Window */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#efeae2] dark:bg-[#0b141a] relative">
          {selectedChat ? (
            <ChatWindow
              chat={selectedChat}
              messages={messages || []}
              messagesLoading={messagesLoading}
              sessionId={sessionId || ''}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#667781] dark:text-[#8696a0]">
              <Inbox className="h-24 w-24 mb-4 opacity-10" />
              <h2 className="text-2xl font-light mb-2">WaCRM للكمبيوتر</h2>
              <p className="max-w-md text-sm leading-relaxed">
                أرسل واستقبل الرسائل دون إبقاء هاتفك متصلاً بالإنترنت.<br />
                استخدم WaCRM على ما يصل إلى 4 أجهزة مرتبطة وهاتف واحد في وقت واحد.
              </p>
            </div>
          )}
        </div>

        {/* Contact Details (Optional/Desktop) */}
        {selectedChat && (
          <div className="hidden lg:block w-[25%] bg-white dark:bg-[#111b21] border-l dark:border-[#2f3b43]">
            <ContactDetails chat={selectedChat} />
          </div>
        )}
      </div>
    </>
  );
}
