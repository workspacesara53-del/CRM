import type { User, Chat, Message, Contact, Category, Bot } from './types';


export const mockUser: User = {
  id: 'user-1',
  name: 'أحمد الرئيسي',
  email: 'ahmad@wacrm.com',
  role: 'ADMIN',
  avatar: 'https://i.pravatar.cc/150?u=user-1',
};

// This mock data is being kept for other pages that still use it.
// The chat page now uses live data from Firebase.

export const mockChats: any[] = [
  {
    id: 'chat-1',
    remoteId: '971501234567@c.us',
    name: 'سارة خالد',
    type: 'INDIVIDUAL',
    status: 'INBOX',
    isUnread: true,
    lastMessage: 'تمام، سأرسل لك التفاصيل الآن.',
    lastMessageAt: new Date(Date.now() - 5 * 60 * 1000),
    avatar: 'https://i.pravatar.cc/150?u=sara',
    assignedTo: 'user-1',
  },
];

export const mockMessages: { [chatId: string]: Message[] } = {
  'chat-1': [
    {
      id: 'msg-1-1',
      chat_id: 'chat-1',
      session_id: 'session-1',
      remote_id: '971501234567@c.us',
      sender: 'سارة خالد',
      body: 'مرحبًا، أود الاستفسار عن باقات الأسعار.',
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      is_from_us: false,
      media_type: null,
      media_url: null,
      status: 'read',
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
  ],
};


export const mockContacts: Contact[] = [
  {
    id: 'contact-1',
    name: 'سارة خالد',
    phone: '+971 50 123 4567',
    email: 'sara.k@example.com',
    categoryId: 'cat-1',
    avatar: 'https://i.pravatar.cc/150?u=sara',
    userId: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'contact-2',
    name: 'محمد عبد الله',
    phone: '+971 55 987 6543',
    email: 'mo.abdullah@example.com',
    categoryId: 'cat-2',
    avatar: 'https://i.pravatar.cc/150?u=mohamed',
    userId: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'contact-3',
    name: 'علي حسن',
    phone: '+966 50 112 2334',
    email: 'ali.h@example.com',
    categoryId: 'cat-1',
    avatar: 'https://i.pravatar.cc/150?u=ali-hassan',
    userId: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const mockCategories: Category[] = [
  { id: 'cat-1', name: 'عملاء محتملون', userId: 'user-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cat-2', name: 'عملاء حاليون', userId: 'user-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cat-3', name: 'VIP', userId: 'user-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export const mockBots: Bot[] = [
  {
    id: 'bot-1',
    name: 'بوت الترحيب',
    description: 'بوت آلي للترحيب بالعملاء الجدد',
    personality: 'ودود ومحترف',
    avatar_url: null,
    is_active: true,
    temperature: 0.7,
    max_tokens: 500,
    user_id: 'user-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'bot-2',
    name: 'بوت الرد الذكي',
    description: 'بوت ذكي للرد على استفسارات العملاء',
    personality: 'مفيد وسريع الاستجابة',
    avatar_url: null,
    is_active: true,
    temperature: 0.8,
    max_tokens: 800,
    user_id: 'user-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'bot-3',
    name: 'بوت الرد التلقائي (خارج أوقات العمل)',
    description: 'بوت للرد خارج أوقات الدوام',
    personality: 'مهذب ومختصر',
    avatar_url: null,
    is_active: false,
    temperature: 0.5,
    max_tokens: 300,
    user_id: 'user-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
