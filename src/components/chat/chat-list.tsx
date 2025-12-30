'use client';
import React, { useState, useMemo } from 'react';
import { Search, Inbox, CheckCircle, Archive, MessageSquarePlus, X, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Chat } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface ChatListProps {
  chats: Chat[] | null;
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat?: (phoneNumber: string) => void;
}

type FilterType = 'ALL' | 'INBOX' | 'DONE' | 'ARCHIVED';

export default function ChatList({ chats, selectedChatId, onSelectChat, onNewChat }: ChatListProps) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());

  // Filter chats based on status and search
  const filteredChats = useMemo(() => {
    if (!chats) return null;

    let filtered = chats;

    // Apply status filter
    if (filter === 'INBOX') {
      filtered = filtered.filter(chat => chat.status === 'INBOX' || !chat.status);
    } else if (filter === 'DONE') {
      filtered = filtered.filter(chat => chat.status === 'DONE');
    } else if (filter === 'ARCHIVED') {
      filtered = filtered.filter(chat => (chat.is_archived ?? chat.isArchived));
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(chat => {
        const remoteId = chat.remote_id ?? chat.remoteId;
        const lastMessage = chat.last_message ?? chat.lastMessage;
        return (
          (chat.name?.toLowerCase().includes(query)) ||
          (remoteId?.toLowerCase().includes(query)) ||
          (lastMessage?.toLowerCase().includes(query))
        );
      });
    }

    return filtered;
  }, [chats, filter, searchQuery]);

  const getFormattedTimestamp = (date: Date | string | any) => {
    if (!date) return '';
    try {
      // Check if it's a Firebase Timestamp and convert it
      if (typeof date.toDate === 'function') {
        return formatDistanceToNow(date.toDate(), { addSuffix: true, locale: ar });
      }
      // Assume it's already a Date object or a string
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return '';
      }
      return formatDistanceToNow(dateObj, { addSuffix: true, locale: ar });
    } catch (e) {
      return '';
    }
  };

  const handleNewChat = () => {
    if (phoneNumber.trim() && onNewChat) {
      // Format phone number for WhatsApp (add @s.whatsapp.net)
      const formattedNumber = phoneNumber.replace(/\D/g, '') + '@s.whatsapp.net';
      onNewChat(formattedNumber);
      setNewChatOpen(false);
      setPhoneNumber('');
    }
  };

  const toggleChatSelection = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedChats);
    if (newSelected.has(chatId)) {
      newSelected.delete(chatId);
    } else {
      newSelected.add(chatId);
    }
    setSelectedChats(newSelected);
  };

  const clearSelection = () => {
    setSelectedChats(new Set());
  };

  const selectAll = () => {
    if (!filteredChats) return;
    const allIds = new Set(filteredChats.map(chat => chat.id)) as Set<string>;
    setSelectedChats(allIds);
  };

  const updateChatStatus = async (chatId: string, status: 'INBOX' | 'DONE' | 'ARCHIVED') => {
    try {
      const updates: { status?: 'INBOX' | 'DONE' | 'ARCHIVED'; is_archived?: boolean } = {};

      if (status === 'ARCHIVED') {
        updates.is_archived = true;
        updates.status = 'INBOX'; // Keep status as INBOX but archived
      } else {
        updates.status = status;
        updates.is_archived = false;
      }

      const { error } = await (supabase
        .from('chats') as any)
        .update(updates)
        .eq('id', chatId);

      if (error) throw error;

      toast({
        title: 'تم التحديث',
        description: status === 'DONE' ? 'تم نقل المحادثة إلى تم' : status === 'ARCHIVED' ? 'تم أرشفة المحادثة' : 'تم نقل المحادثة إلى صندوق الوارد',
      });
    } catch (error: any) {
      console.error('Error updating chat status:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تحديث حالة المحادثة',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#111b21]">
      {/* WhatsApp Sidebar Header */}
      <div className="flex items-center justify-between p-3 px-4 bg-[#f0f2f5] dark:bg-[#202c33]">
        <Avatar className="h-10 w-10">
          <AvatarImage src="/default-avatar.png" alt="User" />
          <AvatarFallback className="bg-[#dfe5e7] dark:bg-[#6a7175]">U</AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-2 text-[#54656f] dark:text-[#aebac1]">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-black/5"><Archive className="h-5 w-5" /></Button>
          <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-black/5">
                <MessageSquarePlus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-2xl shadow-2xl border-none">
              <DialogHeader>
                <DialogTitle>محادثة جديدة</DialogTitle>
                <DialogDescription>أدخل رقم الهاتف لبدء محادثة جديدة على WhatsApp.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="مثال: 966xxxxxxxxx"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  dir="ltr"
                  className="rounded-xl border-muted/30 focus-visible:ring-[#00a884]"
                />
                <Button onClick={handleNewChat} className="w-full bg-[#00a884] hover:bg-[#008f72] text-white rounded-xl h-11">
                  بدء المحادثة
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-black/5"><MoreVertical className="h-5 w-5" /></Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-2 px-3 space-y-2 pb-0">
        <div className="relative flex items-center bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg h-[35px] group">
          <Search className="absolute left-3 h-4 w-4 text-[#667781] dark:text-[#8696a0] group-focus-within:text-[#00a884] transition-colors" />
          <Input
            placeholder="بحث أو بدء دردشة جديدة"
            className="pl-10 h-full bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-[14px] placeholder:text-[#667781] dark:placeholder:text-[#8696a0]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex justify-start gap-2 py-1 overflow-x-auto no-scrollbar">
          {(['ALL', 'INBOX', 'DONE', 'ARCHIVED'] as FilterType[]).map((f) => (
            <Button
              key={f}
              variant="ghost"
              size="sm"
              className={cn(
                "rounded-full h-8 px-4 text-[13px] font-normal transition-colors shrink-0",
                filter === f
                  ? "bg-[#dcf8c6] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] hover:bg-[#dcf8c6] dark:hover:bg-[#005c4b]"
                  : "bg-[#f0f2f5] dark:bg-[#202c33] text-[#54656f] dark:text-[#aebac1] hover:bg-[#dfe5e7] dark:hover:bg-[#2a3942]"
              )}
              onClick={() => setFilter(f)}
            >
              {f === 'ALL' ? 'الكل' : f === 'INBOX' ? 'الوارد' : f === 'DONE' ? 'تم' : 'المؤرشفة'}
            </Button>
          ))}
        </div>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {!filteredChats ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <p>لا توجد محادثات</p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <div
                key={chat.id}
                className={cn(
                  'flex items-center gap-3 p-3 relative transition-all cursor-pointer border-b border-muted/50 last:border-0',
                  selectedChatId === chat.id
                    ? 'bg-[#f0f2f5] dark:bg-[#2a3942]'
                    : 'hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]'
                )}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('[role="checkbox"]')) return;
                  onSelectChat(chat.id);
                }}
              >
                <div onClick={(e) => e.stopPropagation()} className="relative flex-shrink-0">
                  <Avatar className="h-[49px] w-[49px]">
                    <AvatarImage src={chat.avatar} alt={chat.name || 'Chat'} />
                    <AvatarFallback className="bg-[#dfe5e7] dark:bg-[#6a7175] text-[#54656f] dark:text-[#aebac1]">
                      {chat.name ? chat.name.charAt(0) : ((chat.remote_id ?? chat.remoteId) || chat.id || '?').charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className={cn(
                      "font-normal truncate text-[17px] leading-tight text-[#111b21] dark:text-[#e9edef]",
                      (chat.is_unread ?? chat.isUnread) && "font-semibold"
                    )}>
                      {chat.name || ((chat.remote_id ?? chat.remoteId) || chat.id || '').split('@')[0]}
                    </h3>
                    <span className={cn(
                      "text-xs",
                      (chat.is_unread ?? chat.isUnread) ? "text-[#00a884] font-medium" : "text-[#667781] dark:text-[#8696a0]"
                    )}>
                      {getFormattedTimestamp(chat.last_message_at ?? chat.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={cn(
                      "text-[14px] truncate leading-tight max-w-[90%]",
                      (chat.is_unread ?? chat.isUnread) ? "text-[#111b21] dark:text-[#e9edef] font-medium" : "text-[#667781] dark:text-[#8696a0]"
                    )}>
                      {chat.last_message ?? chat.lastMessage}
                    </p>
                    {(chat.is_unread ?? chat.isUnread) && (
                      <Badge className="bg-[#25d366] hover:bg-[#25d366] h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full text-white text-[11px] border-none shadow-none">
                        {chat.unread_count || 1}
                      </Badge>
                    )}
                  </div>
                </div>
                {selectedChatId === chat.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00a884]" />
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
