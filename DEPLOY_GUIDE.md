# دليل إعدادات الربط للمشروع (Environment Variables)

استخدم هذا الملف لنسخ القيم ولصقها مباشرة في مواقع الاستضافة (Vercel و Railway).

---

## أولاً: إعدادات موقع Vercel (لوحة التحكم والواجهة)
اذهب إلى: **Vercel Project Settings** -> **Environment Variables** وأضف الآتي:

### 1. رابط قاعدة البيانات
- **اسم المتغير (Key):** `NEXT_PUBLIC_SUPABASE_URL`
- **القيمة (Value):** `https://nttwamoqfqvufnogyegi.supabase.co`

### 2. المفتاح العام (Anon Key)
- **اسم المتغير (Key):** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **القيمة (Value):** `sb_publishable_I7N9pNlxSqt-NVpCaHGL0w_G6VhtJ9o`

### 3. مفتاح الإدارة السري (Service Role)
- **اسم المتغير (Key):** `SUPABASE_SERVICE_ROLE_KEY`
- **القيمة (Value):** `sb_secret_dcV16XTHF4NgeA_8IE6J8g_YZwTPlJ2`

---

## ثانياً: إعدادات موقع Railway (خدمة الواتساب المستمرة)
اذهب إلى: **Railway Project** -> **Variables** وأضف الآتي:

### 1. رابط قاعدة البيانات
- **اسم المتغير (Key):** `SUPABASE_URL`
- **القيمة (Value):** `https://nttwamoqfqvufnogyegi.supabase.co`

### 2. مفتاح الإدارة السري
- **اسم المتغير (Key):** `SUPABASE_SERVICE_ROLE_KEY`
- **القيمة (Value):** `sb_secret_dcV16XTHF4NgeA_8IE6J8g_YZwTPlJ2`

---

## ملاحظات هامة:
*   **لا تترك مسافات:** عند النسخ، تأكد أنك تمسح أي مسافة في بداية أو نهاية الكود.
*   **بعد الحفظ في Vercel:** يجب الذهاب إلى تبويب **Deployments** وعمل **Redeploy** للنسخة الأخيرة لكي يتم تفعيل الإعدادات الجديدة.
