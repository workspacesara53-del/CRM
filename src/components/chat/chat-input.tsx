// src/components/chat/chat-input.tsx
'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Paperclip, Smile, Mic, Send, Bot, Loader2, StopCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Chat } from '@/lib/types';
import { respondToInquiry } from '@/ai/flows/respond-to-customer-inquiries';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * Global send lock (shared across multiple mounted ChatInput instances).
 * Fixes duplicate manual-send when the input is rendered twice (desktop/mobile layouts)
 * or when two handlers race.
 */
const globalSendLocks = new Map<string, boolean>();
const globalLastSendAt = new Map<string, number>();

interface ChatInputProps {
  chat: Chat;
  sessionId: string;
}

export default function ChatInput({ chat, sessionId }: ChatInputProps) {
  const { toast } = useToast();

  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Local lock (per instance) + in-flight request id
  const sendingRef = useRef(false);
  const inflightClientRequestIdRef = useRef<string | null>(null);

  const getLockKey = () => `${sessionId}:${chat?.id || 'nochat'}`;

  const handleSendMessage = useCallback(async () => {
    const text = message.trim();
    if (!text || !chat || !sessionId) return;

    const lockKey = getLockKey();

    // Extra protection: tiny throttle (prevents ultra-fast double triggers)
    const now = Date.now();
    const lastAt = globalLastSendAt.get(lockKey) || 0;
    if (now - lastAt < 600) return;

    // Global lock across any ChatInput instances
    if (globalSendLocks.get(lockKey)) return;

    // Local lock for this instance
    if (sendingRef.current) return;

    // Lock immediately (no waiting for React state)
    globalSendLocks.set(lockKey, true);
    globalLastSendAt.set(lockKey, now);
    sendingRef.current = true;
    setIsSending(true);

    // IMPORTANT: use the same clientRequestId for this in-flight send
    // so even if something somehow re-enters, it won't generate a new id.
    const clientRequestId =
      inflightClientRequestIdRef.current || crypto.randomUUID();
    inflightClientRequestIdRef.current = clientRequestId;

    try {
      // Prefer phone_jid if present (avoid LID surprises)
      const remoteJid = chat.phone_jid || chat.remote_id || chat.remoteId || '';

      const response = await fetch('/api/messages/manual-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          to: remoteJid,
          text,
          clientRequestId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to send message');
      }

      setMessage('');
      toast({
        title: 'تم إرسال الرسالة',
        description: data?.deduped
          ? 'تم منع إرسال مكرر (Idempotency)'
          : 'تم إرسال رسالتك بنجاح',
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'خطأ',
        description: error?.message || 'فشل إرسال الرسالة',
        variant: 'destructive',
      });
    } finally {
      inflightClientRequestIdRef.current = null;
      setIsSending(false);
      sendingRef.current = false;
      globalSendLocks.delete(lockKey);
    }
  }, [message, chat, sessionId, toast]);

  const handleAiRespond = async () => {
    if (!chat || !sessionId) return;

    setIsAiResponding(true);
    try {
      const result = await respondToInquiry({
        message: message || '',
        chatContext: String(chat.id || sessionId),
      });
      console.log('AI Response:', result);
    } catch (error) {
      console.error('Error getting AI response:', error);
    } finally {
      setIsAiResponding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ignore IME composition (Arabic/emoji/IME can cause duplicate Enter behaviors)
    // @ts-ignore
    if (e.isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      // Prevent held-key repeat
      if (e.repeat) return;

      // If already sending (any instance)
      const lockKey = getLockKey();
      if (globalSendLocks.get(lockKey) || sendingRef.current) return;

      handleSendMessage();
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast({
      title: 'قريباً',
      description: 'سيتم إضافة إرسال الملفات قريباً',
    });

    e.target.value = '';
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioChunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        // const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        toast({
          title: 'قريباً',
          description: 'سيتم إضافة إرسال الرسائل الصوتية قريباً',
        });

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: 'خطأ',
        description: 'فشل الوصول إلى الميكروفون',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const commonEmojis = ['😊', '👍', '❤️', '😂', '🙏', '👋', '✅', '🎉', '🔥', '💯'];

  return (
    <div className="bg-[#f0f2f5] dark:bg-[#202c33] p-2 flex items-end gap-2 px-4 shadow-inner">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
      />

      <div className="flex items-center gap-1 mb-1 text-[#54656f] dark:text-[#aebac1]">
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-black/5 h-10 w-10 shrink-0" title="إضافة إيموجي">
              <Smile className="h-6 w-6" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2 rounded-xl shadow-2xl border-none">
            <div className="grid grid-cols-6 gap-1">
              {commonEmojis.map((emoji) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  className="text-2xl h-10 w-10 p-0"
                  onClick={() => handleEmojiSelect(emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="icon" className="rounded-full hover:bg-black/5 h-10 w-10 shrink-0" onClick={handleFileSelect} title="إرفاق ملف">
          <Paperclip className="h-6 w-6" />
        </Button>
      </div>

      <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg px-3 py-1 mb-1 min-h-[42px] flex items-center">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="اكتب رسالتك هنا..."
          className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[24px] h-[24px] p-0 text-[15px] resize-none leading-normal text-[#111b21] dark:text-[#e9edef] placeholder:text-[#667781] dark:placeholder:text-[#8696a0]"
          disabled={isSending}
        />
      </div>

      <div className="flex items-center gap-1 mb-1 text-[#54656f] dark:text-[#aebac1]">
        {chat.mode === 'ai' && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-black/5 h-10 w-10 shrink-0"
            onClick={handleAiRespond}
            disabled={isAiResponding}
            title="رد تلقائي بالذكاء الاصطناعي"
          >
            {isAiResponding ? <Loader2 className="h-6 w-6 animate-spin text-[#00a884]" /> : <Bot className="h-6 w-6" />}
          </Button>
        )}

        {message.trim() ? (
          <Button
            onClick={handleSendMessage}
            disabled={isSending}
            size="icon"
            variant="ghost"
            className="rounded-full hover:bg-black/5 h-10 w-10 shrink-0 text-[#00a884]"
          >
            {isSending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6" />}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={cn("rounded-full hover:bg-black/5 h-10 w-10 shrink-0", isRecording ? "text-red-500" : "")}
            onClick={isRecording ? stopRecording : startRecording}
            title={isRecording ? 'إيقاف التسجيل' : 'تسجيل رسالة صوتية'}
          >
            {isRecording ? <StopCircle className="h-6 w-6 animate-pulse" /> : <Mic className="h-6 w-6" />}
          </Button>
        )}
      </div>
    </div>
  );
}
