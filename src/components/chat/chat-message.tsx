'use client';
import React from 'react';
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { FileText, Image as ImageIcon, Video, Music, Sticker, Check, CheckCheck, Clock } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isFromUs = message.is_from_us ?? message.isFromUs ?? false;

  const getFormattedTimestamp = (ts: Date | string) => {
    try {
      const date = typeof ts === 'string' ? new Date(ts) : ts;
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
      return format(date, 'HH:mm', { locale: ar });
    } catch (e) {
      return '';
    }
  };

  const StatusIcon = () => {
    if (!isFromUs) return null;
    const status = message.status;

    switch (status) {
      case 'pending':
        return <Clock className="h-3 w-3 text-muted-foreground/60" />;
      case 'sent':
        return <Check className="h-3 w-3 text-muted-foreground/60" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-muted-foreground/60" />;
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'failed':
        return <span className="text-[10px] text-red-500">!</span>;
      default:
        return <Check className="h-3 w-3 text-muted-foreground/60" />;
    }
  };

  const getMediaIcon = () => {
    const mediaType = message.media_type ?? message.mediaType;
    switch (mediaType) {
      case 'image': return <ImageIcon className="h-4 w-4 inline mr-1" />;
      case 'video': return <Video className="h-4 w-4 inline mr-1" />;
      case 'audio': return <Music className="h-4 w-4 inline mr-1" />;
      case 'document': return <FileText className="h-4 w-4 inline mr-1" />;
      case 'sticker': return <Sticker className="h-4 w-4 inline mr-1" />;
      default: return null;
    }
  };

  const renderMedia = () => {
    const mediaUrl = message.media_url ?? message.mediaUrl;
    const mediaType = message.media_type ?? message.mediaType;
    if (!mediaUrl) return null;

    switch (mediaType) {
      case 'image':
        return (
          <div className="relative">
            <img src={mediaUrl} alt="" className="rounded-md max-w-full h-auto max-h-80 object-cover" loading="lazy" />
            {message.body && message.body !== '📷 صورة' && (
              <p className="text-sm mt-1 mb-1">{message.body}</p>
            )}
          </div>
        );
      case 'sticker':
        return <img src={mediaUrl} alt="" className="w-28 h-28 object-contain" loading="lazy" />;
      case 'audio':
        return <audio controls className="h-8 max-w-[200px] mt-1"><source src={mediaUrl} type="audio/ogg" /></audio>;
      case 'video':
        return (
          <div className="relative">
            <video controls className="rounded-md max-w-full h-auto max-h-80"><source src={mediaUrl} type="video/mp4" /></video>
            {message.body && message.body !== '🎥 فيديو' && (
              <p className="text-sm mt-1 mb-1">{message.body}</p>
            )}
          </div>
        );
      case 'document':
        return (
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-black/5 rounded-md hover:bg-black/10 transition-colors">
            <FileText className="h-8 w-8 text-primary" />
            <span className="text-xs truncate max-w-[150px]">{message.body || 'Document'}</span>
          </a>
        );
      default: return null;
    }
  };

  const mediaType = message.media_type ?? message.mediaType;
  const mediaUrl = message.media_url ?? message.mediaUrl;

  const hasCaption = message.body && !['📷 صورة', '🎥 فيديو', '🎵 مقطع صوتي', '📄 مستند', 'Sticker'].includes(message.body);
  const isSticker = mediaType === 'sticker';

  return (
    <div className={cn("flex w-full mb-1 px-4 sm:px-6", isFromUs ? "justify-end" : "justify-start")}>
      <div className={cn(
        "chat-bubble relative min-w-[70px]",
        isFromUs ? "chat-bubble-sent" : "chat-bubble-received",
        isSticker && "bg-transparent shadow-none dark:bg-transparent after:hidden before:hidden p-0"
      )}>
        {mediaType && mediaUrl ? (
          <div className="flex flex-col">
            {renderMedia()}
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words pb-1 pr-1">
            {message.body}
          </p>
        )}

        <div className={cn(
          "flex items-center justify-end gap-1 float-right mt-[-4px] ml-2",
          (mediaType === 'image' || mediaType === 'video') && !hasCaption ? "absolute bottom-1 right-1 bg-black/30 px-1.5 rounded-sm text-white backdrop-blur-[2px]" : "",
          isSticker && "absolute -bottom-5 right-0 bg-transparent text-muted-foreground"
        )}>
          <span className={cn(
            "text-[10px]",
            (mediaType === 'image' || mediaType === 'video') && !hasCaption ? "text-white" : "text-muted-foreground/70"
          )}>
            {getFormattedTimestamp(message.timestamp)}
          </span>
          {!isSticker && <StatusIcon />}
        </div>
      </div>
    </div>
  );
}
