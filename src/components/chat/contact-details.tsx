import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatE164FromJid, getDisplayJid, getDisplayName, needsMapping } from "@/lib/phone-display";
import type { Chat } from "@/lib/types";
import { Mail, Phone } from "lucide-react";

interface ContactDetailsProps {
  chat: Chat;
}

export default function ContactDetails({ chat }: ContactDetailsProps) {
  const displayDigits = getDisplayJid(chat);
  const displayPhone = formatE164FromJid(chat.phone_jid || chat.phoneJid || null);
  const displayName = getDisplayName(chat);
  const mappingNeeded = needsMapping(chat);

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] dark:bg-[#111b21]">
      {/* Header */}
      <div className="flex items-center p-4 bg-white dark:bg-[#202c33] border-b dark:border-[#2f3b43]">
        <h3 className="font-medium text-[16px]">معلومات جهة الاتصال</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2">
          {/* Profile Section */}
          <div className="bg-white dark:bg-[#202c33] p-6 flex flex-col items-center text-center shadow-sm">
            <Avatar className="h-48 w-48 mb-4">
              <AvatarImage src={chat.avatar || undefined} alt={displayName} />
              <AvatarFallback className="text-4xl bg-[#dfe5e7] dark:bg-[#6a7175]">{displayName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] font-normal text-[#111b21] dark:text-[#e9edef]">{displayName}</h2>
              {mappingNeeded && <Badge variant="destructive" className="text-[10px]">يحتاج ربط</Badge>}
            </div>
            <p className="text-[14px] text-[#667781] dark:text-[#8696a0] mt-1" dir="ltr">
              {displayPhone || displayDigits || "Unknown"}
            </p>
          </div>

          {/* About Section */}
          <div className="bg-white dark:bg-[#202c33] p-4 shadow-sm space-y-2">
            <h4 className="text-[14px] text-[#667781] dark:text-[#8696a0]">الأخبار</h4>
            <p className="text-[15px] text-[#111b21] dark:text-[#e9edef]">Available / متوفر</p>
          </div>

          {/* Media Section */}
          <div className="bg-white dark:bg-[#202c33] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2 text-right" dir="rtl">
              <h4 className="text-[14px] text-[#667781] dark:text-[#8696a0]">الوسائط والروابط والمستندات</h4>
              <span className="text-[14px] text-[#667781] dark:text-[#8696a0] cursor-pointer">0 &gt;</span>
            </div>
            <div className="flex gap-2 h-20 overflow-hidden opacity-30">
              <div className="w-20 bg-muted rounded-sm" />
              <div className="w-20 bg-muted rounded-sm" />
              <div className="w-20 bg-muted rounded-sm" />
            </div>
          </div>

          {/* Settings Section */}
          <div className="bg-white dark:bg-[#202c33] shadow-sm divide-y dark:divide-[#2f3b43]">
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-black/5">
              <span className="text-[15px]">كتم الإشعارات</span>
              <div className="w-8 h-4 bg-muted rounded-full relative"><div className="absolute left-0 top-0 w-4 h-4 bg-white rounded-full border" /></div>
            </div>
            <div className="p-4 cursor-pointer hover:bg-black/5">
              <p className="text-[15px]">الرسائل ذاتية الاختفاء</p>
              <p className="text-[12px] text-[#667781] dark:text-[#8696a0]">متوقف</p>
            </div>
            <div className="p-4 cursor-pointer hover:bg-black/5">
              <p className="text-[15px]">التشفير</p>
              <p className="text-[12px] text-[#667781] dark:text-[#8696a0]">الرسائل مشفرة تماماً بين الطرفين. انقر للتحقق.</p>
            </div>
          </div>

          {/* Dangerous Actions */}
          <div className="bg-white dark:bg-[#202c33] shadow-sm mb-6">
            <div className="p-4 flex items-center gap-4 text-red-500 cursor-pointer hover:bg-black/5">
              <span className="text-[15px]">حظر {displayName}</span>
            </div>
            <div className="p-4 flex items-center gap-4 text-red-500 cursor-pointer hover:bg-black/5">
              <span className="text-[15px]">الإبلاغ عن {displayName}</span>
            </div>
            <div className="p-4 flex items-center gap-4 text-red-500 cursor-pointer hover:bg-black/5">
              <span className="text-[15px]">حذف الدردشة</span>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
