import { Request, Response, NextFunction } from 'express';
import { BotStatus, Prisma, SessionState } from '@prisma/client';
import { prisma } from '../core/prisma';
import { env } from '../config/env';
import { generateBlueprint } from '../core/aiBuilder';
import { encrypt } from '../core/encryption';
import { getMe, sendMessage, setWebhook } from '../core/telegram';
import { parseTelegramUpdate } from '../core/telegramUpdateParser';
import { buildMenuKeyboard } from '../core/flowEngine';
import { getDraftFlow } from '../services/flow.service';

const previewKeyboard = {
  inline_keyboard: [
    [
      { text: '👀 معاينة البوت', callback_data: 'draft:preview' },
      { text: '✏️ تعديل البوت', callback_data: 'draft:edit' }
    ],
    [{ text: '🚀 نشر البوت', callback_data: 'draft:publish' }]
  ]
};

const MASTER_TOKEN = env.MASTER_BOT_TOKEN;

const normalizeText = (text?: string) => text?.trim() ?? '';

const isCommand = (text: string) => text.startsWith('/');

const tokenPattern = /^\d+:[A-Za-z0-9_-]+$/;

const ensureUser = async (telegramUser: {
  id: number;
  first_name: string;
  username?: string;
}) => {
  return prisma.user.upsert({
    where: { telegramId: telegramUser.id.toString() },
    update: {
      name: telegramUser.first_name,
      username: telegramUser.username
    },
    create: {
      telegramId: telegramUser.id.toString(),
      name: telegramUser.first_name,
      username: telegramUser.username
    }
  });
};

const getSession = async (userId: string) => {
  return prisma.session.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' }
  });
};

const setSession = async (
  userId: string,
  state: SessionState,
  data?: Record<string, unknown>
) => {
  const existing = await getSession(userId);
  if (existing) {
    return prisma.session.update({
      where: { id: existing.id },
      data: { state, data: data as Prisma.InputJsonValue }
    });
  }

  return prisma.session.create({
    data: { userId, state, data: data as Prisma.InputJsonValue }
  });
};

const getDraftMenu = (draftFlow: { blueprint: unknown }, bot: { draftMenuLabels?: unknown }) => {
  const menu = (bot.draftMenuLabels as Array<{ title: string; action: string }>) ??
    ((draftFlow.blueprint as { menu?: Array<{ title: string; action: string }> })?.menu ?? []);
  return menu;
};

export const masterBotHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const update = req.body as Record<string, unknown>;
    const parsed = (req as Request & { telegramUpdate?: ReturnType<typeof parseTelegramUpdate> }).telegramUpdate
      ?? parseTelegramUpdate(update);
    const message = update.message as {
      text?: string;
      from?: { id: number; first_name: string; username?: string };
      chat?: { id: number };
    } | undefined;
    const callback = update.callback_query as {
      id: string;
      data?: string;
      from?: { id: number; first_name: string; username?: string };
      message?: { chat?: { id: number } };
    } | undefined;

    if ((!message && !callback) || !parsed.chatId || !parsed.fromId) {
      return res.json({ ok: true });
    }

    const text = normalizeText(message?.text);
    const chatId = parsed.chatId;

    const user = await ensureUser({
      id: parsed.fromId,
      first_name: message?.from?.first_name ?? callback?.from?.first_name ?? 'User',
      username: message?.from?.username ?? callback?.from?.username
    });

    const session = await getSession(user.id);

    if (parsed.callbackData) {
      if (!session?.data || !(session.data as { botId?: string }).botId) {
        return res.json({ ok: true });
      }
      const botId = (session.data as { botId?: string }).botId as string;
      const bot = await prisma.bot.findUnique({ where: { id: botId } });
      const draftFlow = await getDraftFlow(botId);
      if (!bot || !draftFlow) {
        return res.json({ ok: true });
      }

      if (parsed.callbackData === 'draft:preview') {
        await prisma.bot.update({ where: { id: botId }, data: { status: BotStatus.PREVIEW } });
        await setSession(user.id, SessionState.PREVIEW_MODE, { botId });
        const menuItems = getDraftMenu(draftFlow, bot);
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          '🔍 وضع المعاينة – التغييرات غير محفوظة',
          { reply_markup: buildMenuKeyboard(menuItems) }
        );
        return res.json({ ok: true });
      }

      if (parsed.callbackData === 'draft:edit') {
        await setSession(user.id, SessionState.AWAITING_REVIEW, { botId });
        await sendMessage(MASTER_TOKEN, chatId, 'ماذا تريد تعديل؟', {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✏️ تعديل رسالة الترحيب', callback_data: 'draft:edit_welcome' },
                { text: '🧱 تعديل القوائم', callback_data: 'draft:edit_menu' }
              ],
              [
                { text: '🧩 تعديل زر معيّن', callback_data: 'draft:edit_button' },
                { text: '🧪 إعادة توليد بالذكاء الاصطناعي', callback_data: 'draft:regenerate' }
              ],
              [{ text: '🔙 رجوع', callback_data: 'draft:back' }]
            ]
          }
        });
        return res.json({ ok: true });
      }

      if (parsed.callbackData === 'draft:publish') {
        await setSession(user.id, SessionState.CONFIRM_PUBLISH, { botId });
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'هل أنت متأكد من نشر هذا الإصدار؟',
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ تأكيد النشر', callback_data: 'draft:confirm_publish' },
                  { text: '🔙 رجوع', callback_data: 'draft:back' }
                ]
              ]
            }
          }
        );
        return res.json({ ok: true });
      }

      if (parsed.callbackData === 'draft:back') {
        await setSession(user.id, SessionState.AWAITING_REVIEW, { botId });
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'تم إنشاء البوت بنجاح 🎉\nهل ترغب بمراجعته قبل النشر؟',
          { reply_markup: previewKeyboard }
        );
        return res.json({ ok: true });
      }

      if (parsed.callbackData === 'draft:edit_welcome') {
        await setSession(user.id, SessionState.OWNER_EDIT_WELCOME, { botId });
        await sendMessage(MASTER_TOKEN, chatId, 'أرسل رسالة الترحيب الجديدة.');
        return res.json({ ok: true });
      }

      if (parsed.callbackData === 'draft:edit_menu') {
        await setSession(user.id, SessionState.OWNER_EDIT_MENU, { botId });
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'أرسل أسماء الأزرار الجديدة مفصولة بفواصل.'
        );
        return res.json({ ok: true });
      }

      if (parsed.callbackData === 'draft:edit_button') {
        await setSession(user.id, SessionState.OWNER_EDIT_BUTTON_SELECT, { botId });
        const menuItems = getDraftMenu(draftFlow, bot);
        const buttons = menuItems.map((item, index) => ({
          text: item.title,
          callback_data: `draft:select_button:${index}`
        }));
        await sendMessage(MASTER_TOKEN, chatId, 'اختر الزر الذي تريد تعديله.', {
          reply_markup: { inline_keyboard: buttons.map((b) => [b]) }
        });
        return res.json({ ok: true });
      }

      if (parsed.callbackData === 'draft:regenerate') {
        const regenerated = await generateBlueprint(bot.description ?? 'Bot');
        await prisma.flow.update({
          where: { id: draftFlow.id },
          data: { blueprint: regenerated as unknown as Prisma.InputJsonValue }
        });
        await sendMessage(MASTER_TOKEN, chatId, 'تمت إعادة التوليد بنجاح.');
        return res.json({ ok: true });
      }

      if (parsed.callbackData?.startsWith('draft:select_button:')) {
        const index = Number(parsed.callbackData.split(':')[2]);
        await setSession(user.id, SessionState.OWNER_EDIT_BUTTON_LABEL, {
          botId,
          buttonIndex: index
        });
        await sendMessage(MASTER_TOKEN, chatId, 'أرسل النص الجديد للزر.');
        return res.json({ ok: true });
      }

      if (parsed.callbackData === 'draft:confirm_publish') {
        if (!bot.tokenCipherText || !bot.tokenIv || !bot.tokenTag) {
          await setSession(user.id, SessionState.AWAITING_TOKEN, { botId });
          await sendMessage(MASTER_TOKEN, chatId, 'أرسل توكن البوت لإتمام النشر.');
          return res.json({ ok: true });
        }
        await prisma.flow.update({
          where: { id: draftFlow.id },
          data: { status: 'PUBLISHED' }
        });
        await prisma.bot.update({
          where: { id: botId },
          data: {
            status: BotStatus.PUBLISHED,
            welcomeText: bot.draftWelcomeText ?? bot.welcomeText,
            menuLabels: (bot.draftMenuLabels ?? bot.menuLabels) as unknown as Prisma.InputJsonValue,
            draftWelcomeText: null,
            draftMenuLabels: Prisma.DbNull
          }
        });
        await sendMessage(MASTER_TOKEN, chatId, 'تم نشر البوت بنجاح.');
        return res.json({ ok: true });
      }

      if (session?.state === SessionState.PREVIEW_MODE && parsed.callbackData.startsWith('menu:')) {
        const index = Number(parsed.callbackData.split(':')[1]);
        const menuItems = getDraftMenu(draftFlow, bot);
        const item = menuItems[index];
        if (item) {
          await sendMessage(
            MASTER_TOKEN,
            chatId,
            `🔍 وضع المعاينة – التغييرات غير محفوظة\n\n${item.action}`,
            { reply_markup: buildMenuKeyboard(menuItems) }
          );
        }
        return res.json({ ok: true });
      }

      if (session?.state === SessionState.PREVIEW_MODE && parsed.callbackData === 'nav:home') {
        const menuItems = getDraftMenu(draftFlow, bot);
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          '🔍 وضع المعاينة – التغييرات غير محفوظة',
          { reply_markup: buildMenuKeyboard(menuItems) }
        );
        return res.json({ ok: true });
      }

      if (session?.state === SessionState.PREVIEW_MODE && parsed.callbackData === 'nav:back') {
        const menuItems = getDraftMenu(draftFlow, bot);
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          '🔍 وضع المعاينة – التغييرات غير محفوظة',
          { reply_markup: buildMenuKeyboard(menuItems) }
        );
        return res.json({ ok: true });
      }
    }

    if (!text) {
      return res.json({ ok: true });
    }

    if (text === '/start') {
      await setSession(user.id, SessionState.IDLE);
      await sendMessage(
        MASTER_TOKEN,
        chatId,
        'مرحبا بك! استخدم /create لإنشاء بوت جديد أو /mybots لعرض بوتاتك.'
      );
      return res.json({ ok: true });
    }

    if (text === '/create') {
      await setSession(user.id, SessionState.AWAITING_DESCRIPTION);
      await sendMessage(
        MASTER_TOKEN,
        chatId,
        'اكتب وصف البوت المطلوب إنشاؤه.'
      );
      return res.json({ ok: true });
    }

    if (text === '/mybots') {
      const bots = await prisma.bot.findMany({
        where: { ownerId: user.id },
        orderBy: { createdAt: 'desc' }
      });

      if (bots.length === 0) {
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'لا يوجد بوتات حتى الآن. استخدم /create لإنشاء أول بوت.'
        );
        return res.json({ ok: true });
      }

      const list = bots
        .map((bot) => `• ${bot.name} (${bot.status})`)
        .join('\n');

      await sendMessage(MASTER_TOKEN, chatId, `بوتاتك الحالية:\n${list}`);
      return res.json({ ok: true });
    }

    if (session?.state === SessionState.AWAITING_DESCRIPTION && !isCommand(text)) {
      const blueprint = await generateBlueprint(text);
      const bot = await prisma.bot.create({
        data: {
          name: blueprint.name ?? 'New Bot',
          description: text,
          ownerId: user.id,
          status: BotStatus.DRAFT,
          draftWelcomeText: 'مرحبا! اختر من القائمة.',
          draftMenuLabels: blueprint.menu as unknown as Prisma.InputJsonValue,
          flows: {
            create: {
              name: 'v1',
              version: 1,
              blueprint: blueprint as unknown as Prisma.InputJsonValue,
              status: 'DRAFT'
            }
          }
        }
      });

      await setSession(user.id, SessionState.AWAITING_REVIEW, { botId: bot.id });
      await sendMessage(
        MASTER_TOKEN,
        chatId,
        'تم إنشاء البوت بنجاح 🎉\nهل ترغب بمراجعته قبل النشر؟',
        { reply_markup: previewKeyboard }
      );
      return res.json({ ok: true });
    }

    if (session?.state === SessionState.OWNER_EDIT_WELCOME && !isCommand(text)) {
      const botId = (session.data as { botId?: string })?.botId;
      if (!botId) {
        return res.json({ ok: true });
      }
      await prisma.bot.update({
        where: { id: botId },
        data: { draftWelcomeText: text }
      });
      await setSession(user.id, SessionState.AWAITING_REVIEW, { botId });
      await sendMessage(MASTER_TOKEN, chatId, 'تم تحديث رسالة الترحيب (مسودة).');
      return res.json({ ok: true });
    }

    if (session?.state === SessionState.OWNER_EDIT_MENU && !isCommand(text)) {
      const botId = (session.data as { botId?: string })?.botId;
      if (!botId) {
        return res.json({ ok: true });
      }
      const labels = text
        .split(',')
        .map((label) => label.trim())
        .filter(Boolean)
        .map((label) => ({ title: label, action: label }));
      await prisma.bot.update({
        where: { id: botId },
        data: { draftMenuLabels: labels as Prisma.InputJsonValue }
      });
      await setSession(user.id, SessionState.AWAITING_REVIEW, { botId });
      await sendMessage(MASTER_TOKEN, chatId, 'تم تحديث القائمة (مسودة).');
      return res.json({ ok: true });
    }

    if (session?.state === SessionState.OWNER_EDIT_BUTTON_LABEL && !isCommand(text)) {
      const data = session.data as { botId?: string; buttonIndex?: number };
      if (!data?.botId || data.buttonIndex === undefined) {
        return res.json({ ok: true });
      }
      await setSession(user.id, SessionState.OWNER_EDIT_BUTTON_ACTION, {
        botId: data.botId,
        buttonIndex: data.buttonIndex,
        buttonLabel: text
      });
      await sendMessage(MASTER_TOKEN, chatId, 'أرسل الرسالة/الوجهة الجديدة لهذا الزر.');
      return res.json({ ok: true });
    }

    if (session?.state === SessionState.OWNER_EDIT_BUTTON_ACTION && !isCommand(text)) {
      const data = session.data as { botId?: string; buttonIndex?: number; buttonLabel?: string };
      if (!data?.botId || data.buttonIndex === undefined || !data.buttonLabel) {
        return res.json({ ok: true });
      }
      const bot = await prisma.bot.findUnique({ where: { id: data.botId } });
      const draftFlow = await getDraftFlow(data.botId);
      if (!bot || !draftFlow) {
        return res.json({ ok: true });
      }
      const menuItems = getDraftMenu(draftFlow, bot);
      menuItems[data.buttonIndex] = {
        title: data.buttonLabel,
        action: text
      };
      await prisma.bot.update({
        where: { id: data.botId },
        data: { draftMenuLabels: menuItems as unknown as Prisma.InputJsonValue }
      });
      await setSession(user.id, SessionState.AWAITING_REVIEW, { botId: data.botId });
      await sendMessage(MASTER_TOKEN, chatId, 'تم تحديث الزر (مسودة).');
      return res.json({ ok: true });
    }

    if (session?.state === SessionState.PREVIEW_MODE && !isCommand(text)) {
      const botId = (session.data as { botId?: string })?.botId;
      if (!botId) {
        return res.json({ ok: true });
      }
      const bot = await prisma.bot.findUnique({ where: { id: botId } });
      const draftFlow = await getDraftFlow(botId);
      if (!bot || !draftFlow) {
        return res.json({ ok: true });
      }
      const menuItems = getDraftMenu(draftFlow, bot);
      await sendMessage(
        MASTER_TOKEN,
        chatId,
        '🔍 وضع المعاينة – التغييرات غير محفوظة',
        { reply_markup: buildMenuKeyboard(menuItems) }
      );
      return res.json({ ok: true });
    }

    if (session?.state === SessionState.AWAITING_TOKEN && !isCommand(text)) {
      if (!tokenPattern.test(text)) {
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'صيغة التوكن غير صحيحة. حاول مرة أخرى.'
        );
        return res.json({ ok: true });
      }

      const botId = (session.data as { botId?: string })?.botId;
      if (!botId) {
        await setSession(user.id, SessionState.IDLE);
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'حدث خطأ. ابدأ من جديد باستخدام /create.'
        );
        return res.json({ ok: true });
      }

      const botInfo = await getMe(text);
      const encrypted = encrypt(text);

      const bot = await prisma.bot.update({
        where: { id: botId },
        data: {
          tokenCipherText: encrypted.cipherText,
          tokenIv: encrypted.iv,
          tokenTag: encrypted.tag,
          telegramUser: botInfo.username,
          status: BotStatus.PUBLISHED
        }
      });

      await prisma.flow.updateMany({
        where: { botId, status: 'DRAFT' },
        data: { status: 'PUBLISHED' }
      });
      await prisma.bot.update({
        where: { id: botId },
        data: {
          welcomeText: bot.draftWelcomeText ?? bot.welcomeText,
          menuLabels: (bot.draftMenuLabels ?? bot.menuLabels) as unknown as Prisma.InputJsonValue,
          draftWelcomeText: null,
          draftMenuLabels: Prisma.DbNull
        }
      });
      await setWebhook(text, `${env.BASE_URL}/tg/${botId}/webhook`, env.WEBHOOK_SECRET);
      await setSession(user.id, SessionState.IDLE);

      await sendMessage(
        MASTER_TOKEN,
        chatId,
        'تم تفعيل البوت بنجاح وربط الـ webhook.'
      );
      return res.json({ ok: true });
    }

    await sendMessage(
      MASTER_TOKEN,
      chatId,
      'أمر غير معروف. استخدم /start للبدء.'
    );
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
};
