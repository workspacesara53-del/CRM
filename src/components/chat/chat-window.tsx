'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MoreVertical, Phone, Video, Loader2, Bot as BotIcon, User, Search } from "lucide-react";
import ChatInput from "./chat-input";
import ChatMessage from "./chat-message";
import type { Chat, Message, Bot } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { dedupeMessages, messageKeys } from '@/lib/message-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getDisplayName, needsMapping } from "@/lib/phone-display";
import { cn } from "@/lib/utils";

interface ChatWindowProps {
  chat: Chat;
  messages: Message[];
  messagesLoading: boolean;
  sessionId: string;
}

export default function ChatWindow({ chat, messages, messagesLoading, sessionId }: ChatWindowProps) {
  const { toast } = useToast();
  const [isTogglingMode, setIsTogglingMode] = useState(false);
  const [bots, setBots] = useState<Bot[]>([]);
  const [currentBot, setCurrentBot] = useState<Bot | null>(null);
  const botsFetchedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const displayName = getDisplayName(chat);
  const mappingNeeded = needsMapping(chat);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current && !messagesLoading) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, messagesLoading]);

  const uniqueMessages = useMemo(() => dedupeMessages(messages || []), [messages]);
  const getMessageKey = (msg: Message) => messageKeys(msg)[0] || msg.id;

  // Fetch available bots (once)
  useEffect(() => {
    if (botsFetchedRef.current) return;
    botsFetchedRef.current = true;

    const fetchBots = async () => {
      try {
        const { data, error } = await supabase
          .from('bots')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setBots(data || []);
      } catch (error) {
        console.error('Error fetching bots:', error);
      }
    };

    fetchBots();
  }, []);

  // Set current bot when chat changes or bots are loaded
  useEffect(() => {
    if (chat.bot_id && bots.length > 0) {
      const bot = bots.find((b: Bot) => b.id === chat.bot_id);
      setCurrentBot(bot || null);
    } else {
      setCurrentBot(null);
    }
  }, [chat, bots]);

  const toggleMode = async () => {
    if (isTogglingMode) return;

    try {
      setIsTogglingMode(true);
      const newMode = chat.mode === 'ai' ? 'human' : 'ai';

      // Update via API
      const response = await fetch('/api/chats/toggle-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          chatId: chat.id,
          mode: newMode,
        }),
      });

      if (response.ok) {
        toast({
          title: newMode === 'ai' ? 'تم التبديل إلى الوضع الذكي' : 'تم التبديل إلى الوضع اليدوي',
          description: newMode === 'ai' ? 'سيرد الذكاء الاصطناعي تلقائياً' : 'يجب الرد يدوياً على الرسائل',
        });
      } else {
        throw new Error('Failed to toggle mode');
      }
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: 'فشل تبديل الوضع',
        variant: 'destructive',
      });
    } finally {
      setIsTogglingMode(false);
    }
  };

  const assignBot = async (botId: string | null) => {
    try {
      const { error } = await (supabase
        .from('chats') as any)
        .update({ bot_id: botId })
        .eq('id', chat.id);

      if (error) throw error;

      const bot = bots.find(b => b.id === botId);
      setCurrentBot(bot || null);

      toast({
        title: botId ? 'تم تعيين البوت' : 'تم إلغاء تعيين البوت',
        description: botId ? `تم تعيين ${bot?.name}` : 'سيتم استخدام الإعدادات الافتراضية',
      });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: 'فشل تعيين البوت',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="flex flex-col h-full rounded-none border-none shadow-none bg-[#efeae2] dark:bg-[#0b141a]">
      {/* WhatsApp Header */}
      <div className="flex items-center p-3 px-4 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-muted/20">
        <div className="flex items-center gap-3 flex-1">
          <Avatar className="h-10 w-10">
            <AvatarImage src={chat.avatar} alt={chat.name || "Chat"} />
            <AvatarFallback className="bg-[#dfe5e7] dark:bg-[#6a7175] text-[#54656f] dark:text-[#aebac1]">
              {displayName ? displayName.charAt(0) : 'C'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-[#111b21] dark:text-[#e9edef] truncate">{displayName}</h3>
            <p className="text-[12px] text-[#667781] dark:text-[#8696a0]">
              {(chat.mode === 'ai') ? 'الذكاء الاصطناعي متصل' : 'متصل الآن'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[#54656f] dark:text-[#aebac1]">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-black/5"><Video className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-black/5"><Phone className="h-5 w-5" /></Button>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-black/5"><Search className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-black/5"><MoreVertical className="h-5 w-5" /></Button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* The Wallpaper Layer */}
        <div className="wa-wallpaper" />

        <ScrollArea className="flex-1 p-4 sm:px-10 z-10">
          {messagesLoading && messages.length === 0 ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-[#00a884]" />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {uniqueMessages.length === 0 ? (
                <div className="flex justify-center mt-20">
                  <Badge variant="secondary" className="bg-[#fff9c2] dark:bg-[#182229] dark:text-[#ffd279] text-[#54656f] border-none font-normal text-[12.5px] py-1 px-3 shadow-sm rounded-md uppercase tracking-wider">
                    Messages are end-to-end encrypted
                  </Badge>
                </div>
              ) : (
                uniqueMessages.map((message) => (
                  <ChatMessage
                    key={getMessageKey(message)}
                    message={message}
                  />
                ))
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </ScrollArea>
      </div>

      <div>
        <ChatInput chat={chat} sessionId={sessionId} />
      </div>
    </Card>
  );
}
