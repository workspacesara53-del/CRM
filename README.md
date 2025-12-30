# 🚀 WhatsApp CRM AI - Ultimate Business Automation

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-emerald?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

منصة متقدمة لإدارة علاقات العملاء (CRM) مدمجة مع واتساب ومدعومة بالذكاء الاصطناعي (Gemini)، مصممة لتبسيط التواصل وأتمتة الردود باحترافية عالية.

---

## ✨ المميزات الرئيسية (Core Features)

- **🤖 AI Agent Integration:** ردود ذكية وتلقائية باستخدام Google Gemini API.
- **📱 Real-time WhatsApp sync:** ربط مباشر مع حساب واتساب عبر QR Code (Baileys Library).
- **📊 Advanced Analytics:** تقارير شاملة عن أداء الفريق، عدد الرسائل، وأوقات الذروة.
- **👥 Team Management:** إضافة موظفين وتوزيع المحادثات والأدوار (Admin/Agent).
- **📅 Campaign Management:** إنشاء حملات إرسال جماعي (Bulk Messaging) مجدولة أو فورية.
- **⚡ Canned Responses:** اختصارات للردود السريعة المتكررة لتحسين كفاءة الفريق.
- **🔍 Smart CRM:** قاعدة بيانات للعملاء مع سجل كامل للمحادثات، تصنيفات، وملاحظات.

---

## 🛠 البنية التقنية (Tech Stack)

### **Frontend & Backend API**
- **Next.js 15 (App Router)** - SSR, Edge Functions & Middlewares.
- **Shadcn/UI & Tailwind CSS** - واجهة مستخدم عصرية وسريعة الاستجابة.
- **TypeScript** - كود برمجي آمن ومنظم.

### **Database & Auth**
- **Supabase** - PostgreSQL database, Real-time subscriptions, and Authentication.

### **WhatsApp Integration**
- **WhatsApp Worker (Node.js)** - خدمة منفصلة تتعامل مع مكتبة Baileys لإبقاء الاتصال نشطاً ومعالجة الرسائل فورياً.

---

## ⚙️ متغيرات البيئة (Environment Variables)

قم بإنشاء ملف `.env` في الجذر وأضف المتغيرات التالية:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI
GOOGLE_GEMINI_API_KEY=your_gemini_api_key

# General
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🚀 التشغيل المحلي (Local Development)

1. **تثبيت الاعتماديات:**
   ```bash
   npm install
   cd worker-service && npm install
   ```

2. **تشغيل المشروع:**
   - الواجهة (Frontend): `npm run dev`
   - خدمة واتساب (Worker): `cd worker-service && npm start`

---

## ☁️ النشر (Deployment) - الخيار المجاني

المشروع جاهز للنشر على المنصات التالية بدون تكلفة:

1. **الواجهة (Frontend):** يتم رفعها على **Vercel**.
2. **قاعدة البيانات (Database):** يتم إعدادها على **Supabase**.
   - **هام:** قم بتشغيل محتوى ملف `FULL_DATABASE_SETUP.sql` في SQL Editor الخاص بـ Supabase لإنشاء الجداول اللازمة.
3. **خدمة واتساب (Worker):** يتم رفعها كمشروع منفصل على **Render.com** (Web Service).
   - *ملاحظة:* استخدم خدمة **UptimeRobot** لإبقاء الـ Worker نشطاً ومنع خاصية الـ sleep في Render.

---

## 📁 هيكلة المشروع (Project Structure)

```text
├── src/                # Next.js Frontend & API Routes
│   ├── app/            # App Router (Pages & APIs)
│   ├── components/     # UI Components (shadcn & custom)
│   ├── lib/            # Utilities, Types & Supabase Client
│   └── hooks/          # Custom React Hooks
├── worker-service/     # The WhatsApp/Baileys Logic (Node.js)
├── public/             # Static Assets
└── package.json        # Main dependencies
```

---

## 📜 الترخيص (License)

هذا المشروع متاح للاستخدام الشخصي والتجاري. جميع الحقوق محفوظة لـ **Xfuse**.

---
*تم تطوير هذا المشروع ومعالجة جميع أخطاء TypeScript البرمجية لضمان أداء مستقر وقابل للتطوير.*
