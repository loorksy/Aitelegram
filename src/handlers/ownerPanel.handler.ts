import { SessionState } from '@prisma/client';
import { sendMessage } from '../core/telegram';
import { buildMenuKeyboard } from '../core/flowEngine';
import { updateMenuLabels, updateWelcomeText } from '../services/bot.service';
import { listRecentLogs } from '../services/log.service';
import { updateSession } from '../services/session.service';
import { createNotification } from '../services/notification.service';
import { enqueueBroadcast } from '../jobs/notificationQueue';
import { getLast7DaysAnalytics } from '../services/analytics.service';
import { env } from '../config/env';
import { createLog } from '../services/log.service';

export const handleOwnerPanel = async ({
  token,
  chatId,
  botId,
  menuItems,
  callbackData,
  sessionId,
  messageText,
  mode
}: {
  token: string;
  chatId: number;
  botId: string;
  menuItems: Array<{ title: string; action: string }>;
  callbackData?: string;
  sessionId: string;
  messageText?: string;
  mode?: 'OWNER_EDIT_WELCOME' | 'OWNER_EDIT_MENU' | 'OWNER_BROADCAST_NOW' | 'OWNER_SCHEDULE_BROADCAST';
}) => {
  const parseSchedule = (input: string) => {
    const [datePart, messagePart] = input.split('|').map((part) => part.trim());
    if (!datePart || !messagePart) {
      return null;
    }
    const [date, time] = datePart.split(' ');
    if (!date || !time) {
      return null;
    }
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    if (!year || !month || !day || hour === undefined || minute === undefined) {
      return null;
    }
    const scheduledAt = new Date(Date.UTC(year, month - 1, day, hour, minute));
    return { scheduledAt, message: messagePart };
  };

  if (callbackData === 'owner:panel') {
    await sendMessage(
      token,
      chatId,
      'لوحة التحكم: اختر الإجراء المطلوب.',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'تفعيل/إيقاف', callback_data: 'owner:toggle' },
              { text: 'تعديل الترحيب', callback_data: 'owner:welcome' }
            ],
            [
              { text: 'تعديل القائمة', callback_data: 'owner:menu' },
              { text: 'آخر السجلات', callback_data: 'owner:logs' }
            ],
            [
              { text: 'بث فوري', callback_data: 'owner:broadcast_now' },
              { text: 'جدولة بث', callback_data: 'owner:broadcast_schedule' }
            ],
            [
              { text: 'إحصائيات 7 أيام', callback_data: 'owner:stats' },
              { text: 'تصدير CSV', callback_data: 'owner:export_csv' }
            ]
          ]
        }
      }
    );
    await createLog(botId, 'ADMIN_ACTION', 'Owner opened control panel');
    return;
  }

  if (callbackData === 'owner:welcome') {
    await updateSession(sessionId, SessionState.OWNER_EDIT_WELCOME, {
      mode: 'OWNER_EDIT_WELCOME'
    });
    await sendMessage(token, chatId, 'أرسل نص الترحيب الجديد.');
    await createLog(botId, 'ADMIN_ACTION', 'Owner requested welcome edit');
    return;
  }

  if (callbackData === 'owner:menu') {
    await updateSession(sessionId, SessionState.OWNER_EDIT_MENU, {
      mode: 'OWNER_EDIT_MENU'
    });
    await sendMessage(
      token,
      chatId,
      'أرسل أسماء الأزرار الجديدة مفصولة بفواصل (مثال: خدمات, دعم, أسعار).'
    );
    await createLog(botId, 'ADMIN_ACTION', 'Owner requested menu edit');
    return;
  }

  if (callbackData === 'owner:broadcast_now') {
    await updateSession(sessionId, SessionState.OWNER_BROADCAST_NOW, {
      mode: 'OWNER_BROADCAST_NOW'
    });
    await sendMessage(token, chatId, 'أرسل نص الإشعار لإرساله فورًا.');
    await createLog(botId, 'ADMIN_ACTION', 'Owner requested broadcast now');
    return;
  }

  if (callbackData === 'owner:broadcast_schedule') {
    await updateSession(sessionId, SessionState.OWNER_SCHEDULE_BROADCAST, {
      mode: 'OWNER_SCHEDULE_BROADCAST'
    });
    await sendMessage(
      token,
      chatId,
      'أرسل الرسالة بالصيغة: YYYY-MM-DD HH:MM | نص الإشعار (بتوقيت UTC).'
    );
    await createLog(botId, 'ADMIN_ACTION', 'Owner requested scheduled broadcast');
    return;
  }

  if (callbackData === 'owner:logs') {
    const logs = await listRecentLogs(botId);
    const formatted = logs
      .map((log) => `• [${log.level}] ${log.message}`)
      .join('\n');
    await sendMessage(
      token,
      chatId,
      formatted || 'لا توجد سجلات متاحة حتى الآن.'
    );
    await createLog(botId, 'ADMIN_ACTION', 'Owner viewed logs');
    return;
  }

  if (callbackData === 'owner:stats') {
    const stats = await getLast7DaysAnalytics(botId);
    if (stats.length === 0) {
      await sendMessage(token, chatId, 'لا توجد إحصائيات حتى الآن.');
      return;
    }
    const formatted = stats
      .map((row) => {
        const date = row.date.toISOString().split('T')[0];
        return `${date}: start=${row.startCount}, clicks=${row.clickCount}, views=${row.menuViews}`;
      })
      .join('\n');
    await sendMessage(token, chatId, `إحصائيات آخر 7 أيام:\n${formatted}`);
    await createLog(botId, 'ADMIN_ACTION', 'Owner viewed stats');
    return;
  }

  if (callbackData === 'owner:export_csv') {
    await sendMessage(
      token,
      chatId,
      `رابط التصدير: ${env.BASE_URL}/analytics/export?botId=${botId}`
    );
    await createLog(botId, 'ADMIN_ACTION', 'Owner requested CSV export');
    return;
  }

  if (!messageText) {
    return;
  }

  if (mode === 'OWNER_EDIT_MENU') {
    const labels = messageText
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean);
    if (labels.length > 0) {
      const updated = menuItems.map((item, index) => ({
        ...item,
        title: labels[index] ?? item.title
      }));
      await updateMenuLabels(botId, updated);
      await updateSession(sessionId, SessionState.USER_FLOW, { stack: [] });
      await sendMessage(token, chatId, 'تم تحديث القائمة.', {
        reply_markup: buildMenuKeyboard(updated, true)
      });
      return;
    }
    await sendMessage(token, chatId, 'الرجاء إرسال أسماء الأزرار مفصولة بفواصل.');
    return;
  }

  if (mode === 'OWNER_EDIT_WELCOME') {
    await updateWelcomeText(botId, messageText);
    await updateSession(sessionId, SessionState.USER_FLOW, { stack: [] });
    await sendMessage(token, chatId, 'تم تحديث رسالة الترحيب.');
    return;
  }

  if (mode === 'OWNER_BROADCAST_NOW') {
    const notification = await createNotification({
      botId,
      message: messageText,
      target: { type: 'all' }
    });
    await enqueueBroadcast({ botId, message: messageText, notificationId: notification.id });
    await updateSession(sessionId, SessionState.USER_FLOW, { stack: [] });
    await sendMessage(token, chatId, 'تم إرسال البث.');
    await createLog(botId, 'ADMIN_ACTION', 'Owner sent broadcast');
    return;
  }

  if (mode === 'OWNER_SCHEDULE_BROADCAST') {
    const parsed = parseSchedule(messageText);
    if (!parsed) {
      await sendMessage(
        token,
        chatId,
        'صيغة غير صحيحة. استخدم: YYYY-MM-DD HH:MM | نص الإشعار (بتوقيت UTC).'
      );
      return;
    }
    const notification = await createNotification({
      botId,
      message: parsed.message,
      target: { type: 'all' },
      scheduledAt: parsed.scheduledAt
    });
    await enqueueBroadcast({
      botId,
      message: parsed.message,
      scheduledAt: parsed.scheduledAt,
      notificationId: notification.id
    });
    await updateSession(sessionId, SessionState.USER_FLOW, { stack: [] });
    await sendMessage(token, chatId, 'تمت جدولة البث بنجاح.');
    await createLog(botId, 'ADMIN_ACTION', 'Owner scheduled broadcast');
    return;
  }

  if (callbackData === undefined && messageText.includes(',')) {
    const labels = messageText
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean);
    if (labels.length > 0) {
      const updated = menuItems.map((item, index) => ({
        ...item,
        title: labels[index] ?? item.title
      }));
      await updateMenuLabels(botId, updated);
      await updateSession(sessionId, SessionState.USER_FLOW, { stack: [] });
      await sendMessage(token, chatId, 'تم تحديث القائمة.', {
        reply_markup: buildMenuKeyboard(updated, true)
      });
      return;
    }
  }

  await updateWelcomeText(botId, messageText);
  await updateSession(sessionId, SessionState.USER_FLOW, { stack: [] });
  await sendMessage(token, chatId, 'تم تحديث رسالة الترحيب.');
};
