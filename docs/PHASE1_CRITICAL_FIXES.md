# Phase 1 - Critical Fixes Applied

## التغييرات المطبقة

### 1. Webhook Secret Validation ✅
- **الملف**: `src/core/telegram.ts`
- تم إضافة دوال جديدة:
  - `normalizeWebhookSecret()` - تطبيع الـ secret لإزالة الرموز غير المسموحة
  - `generateWebhookSecret()` - توليد secret جديد صالح `[A-Za-z0-9_-]`
  - `isValidWebhookSecret()` - التحقق من صلاحية الـ secret
  - `getValidWebhookSecret()` - الحصول على secret صالح (تطبيع أو توليد جديد)
  - `setWebhookWithValidation()` - إعداد webhook مع التحقق الكامل
  - `getWebhookInfo()` - جلب معلومات الـ webhook الحالية

### 2. Session FK P2003 Fix ✅
- **الملفات**: `src/handlers/userBot.handler.ts`, `src/services/session.service.ts`
- تم إضافة دالة `ensureUserForBot()` لإنشاء/تحديث المستخدم قبل الـ session
- `getOrCreateSession()` الآن تتحقق من وجود المستخدم وتنشئه إذا لم يكن موجوداً
- يتم استخدام `user.id` (UUID) بدلاً من `telegramId` عند إنشاء الـ session

### 3. Publish Flow with Webhook Verification ✅
- **الملف**: `src/handlers/masterBot.handler.ts`
- تم إضافة `publishBotWithValidation()`:
  - التحقق من التوكن باستخدام `getMe()`
  - إعداد الـ webhook وتطبيع الـ secret
  - التحقق من `getWebhookInfo()` بعد الإعداد
  - تخزين الحالة: `WEBHOOK_OK` أو `WEBHOOK_FAILED` مع سبب الخطأ
- تم إضافة `sendPublishSuccessMessage()` و `sendPublishFailureMessage()`

### 4. Display @username After Publish ✅
- بعد النشر الناجح، يتم إرسال:
  - `@bot_username` مع رابط مباشر
  - زر "فتح البوت" مع URL `t.me/bot_username`
  - زر "إدارة البوت"

### 5. Database Schema Updates ✅
- **الملف**: `prisma/schema.prisma`
- تم إضافة حقول جديدة للـ Bot:
  - `telegramBotId` - معرف البوت الرقمي
  - `webhookUrl` - رابط الـ webhook الحالي
  - `webhookSecret` - الـ secret المطبّع
  - `webhookStatus` - الحالة: `WEBHOOK_OK` / `WEBHOOK_FAILED` / `PENDING`
  - `webhookError` - آخر رسالة خطأ
  - `webhookCheckedAt` - تاريخ آخر فحص
- تم إضافة قيم جديدة لـ `BotStatus`: `WEBHOOK_OK`, `WEBHOOK_FAILED`

### 6. Admin APIs ✅
- **الملف**: `src/routes/admin.routes.ts`
- تم إضافة endpoints جديدة:
  - `GET /api/admin/system/health` - فحص صحة النظام (DB, Telegram, Migrations)
  - `GET /api/admin/bots/:botId/webhook-status` - حالة الـ webhook لبوت معين
  - `POST /api/admin/bots/:botId/republish` - إعادة نشر بوت

---

## كيفية التطبيق

### 1. تطبيق Migration على قاعدة البيانات

```bash
# إذا كان لديك PostgreSQL محلي
psql -U postgres -d smart_generator -f prisma/migrations/manual/add_webhook_tracking.sql

# أو باستخدام Prisma
npx prisma db push
```

### 2. إعادة بناء المشروع

```bash
npm run build
```

### 3. إعادة تشغيل الخدمات

```bash
# في Docker
docker compose restart backend

# أو محلياً
npm start
```

---

## كيفية الاختبار

### 1. اختبار Webhook Status

```bash
# الحصول على token
TOKEN=$(curl -s -X POST http://localhost:3010/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"telegramId": "owner123"}' | jq -r '.accessToken')

# فحص صحة النظام
curl -s http://localhost:3010/api/admin/system/health \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 2. اختبار نشر بوت

1. ابدأ محادثة مع الماستر بوت
2. أرسل `/create`
3. اتبع الخطوات وأدخل توكن البوت
4. تحقق من:
   - ظهور رسالة النجاح مع `@bot_username`
   - وجود زر "فتح البوت"
   - أو رسالة خطأ واضحة مع السبب

### 3. التحقق من webhook

```bash
# استخدم API للتحقق من حالة بوت معين
curl -s http://localhost:3010/api/admin/bots/{botId}/webhook-status \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 4. اختبار Session FK

1. أرسل رسالة إلى بوت منشور من مستخدم جديد
2. تحقق من عدم وجود أخطاء P2003 في الـ logs

```bash
# مراقبة الـ logs
tail -f /var/log/supervisor/backend.*.log | grep -i "error\|P2003\|session"
```

---

## Acceptance Criteria ✅

- [ ] `getWebhookInfo` يرجع URL صحيح بدون أخطاء
- [ ] البوت يرد فوراً على `/start` مع زرّين على الأقل
- [ ] لا يوجد أخطاء Prisma P2003 في logs
- [ ] بعد النشر يظهر @bot_username مع زر فتح

---

## الملفات المُعدّلة

```
src/core/telegram.ts          # دوال webhook جديدة
src/handlers/masterBot.handler.ts   # منطق النشر المحسن
src/handlers/userBot.handler.ts     # إصلاح Session FK
src/services/session.service.ts     # getOrCreateSession المحسنة
src/routes/admin.routes.ts          # APIs جديدة
prisma/schema.prisma               # حقول webhook جديدة
prisma/migrations/manual/add_webhook_tracking.sql  # Migration
```
