import { Request, Response, NextFunction } from 'express';
import { BotStatus, Prisma, SessionState } from '@prisma/client';
import { prisma } from '../core/prisma';
import { env } from '../config/env';
import { runAgentPipeline } from '../agents/agentOrchestrator';
import { encrypt } from '../core/encryption';
import {
  getMe,
  sendMessage,
  setWebhookWithValidation,
  getValidWebhookSecret,
  getWebhookInfo,
  TelegramUser
} from '../core/telegram';
import { parseTelegramUpdate } from '../core/telegramUpdateParser';
import { buildMenuKeyboard } from '../core/flowEngine';
import { getDraftFlow } from '../services/flow.service';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

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

/**
 * Publish bot with full webhook validation
 * Returns detailed result for user feedback
 */
const publishBotWithValidation = async (params: {
  botId: string;
  token: string;
  baseUrl: string;
  webhookSecret?: string;
}): Promise<{
  success: boolean;
  botUsername?: string;
  botId?: string;
  webhookUrl?: string;
  webhookStatus: 'WEBHOOK_OK' | 'WEBHOOK_FAILED' | 'PENDING';
  error?: string;
  botInfo?: TelegramUser;
}> => {
  const { botId, token, baseUrl, webhookSecret } = params;

  try {
    // Step 1: Validate bot token with getMe
    let botInfo: TelegramUser;
    try {
      botInfo = await getMe(token);
      logger.info({ botId, botUsername: botInfo.username }, 'Bot token validated');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Token validation failed';
      logger.error({ botId, error: errorMsg }, 'Bot token validation failed');
      return {
        success: false,
        webhookStatus: 'WEBHOOK_FAILED',
        error: `فشل التحقق من التوكن: ${errorMsg}`
      };
    }

    // Step 2: Set webhook with validation
    const webhookUrl = `${baseUrl}/tg/${botId}/webhook`;
    const validSecret = getValidWebhookSecret(webhookSecret);

    const webhookResult = await setWebhookWithValidation(token, webhookUrl, validSecret);

    // Step 3: Update bot with results
    const updateData: Prisma.BotUpdateInput = {
      telegramUser: botInfo.username,
      telegramBotId: botInfo.id.toString(),
      webhookUrl: webhookUrl,
      webhookSecret: validSecret,
      webhookCheckedAt: new Date()
    };

    if (webhookResult.success) {
      updateData.status = BotStatus.WEBHOOK_OK;
      updateData.webhookStatus = 'WEBHOOK_OK';
      updateData.webhookError = null;

      await prisma.bot.update({
        where: { id: botId },
        data: updateData
      });

      logger.info({ botId, webhookUrl, botUsername: botInfo.username }, 'Bot published successfully');

      return {
        success: true,
        botUsername: botInfo.username,
        botId: botInfo.id.toString(),
        webhookUrl,
        webhookStatus: 'WEBHOOK_OK',
        botInfo
      };
    } else {
      updateData.status = BotStatus.WEBHOOK_FAILED;
      updateData.webhookStatus = 'WEBHOOK_FAILED';
      updateData.webhookError = webhookResult.error;

      await prisma.bot.update({
        where: { id: botId },
        data: updateData
      });

      logger.warn({ botId, error: webhookResult.error }, 'Webhook setup failed');

      return {
        success: false,
        botUsername: botInfo.username,
        botId: botInfo.id.toString(),
        webhookUrl,
        webhookStatus: 'WEBHOOK_FAILED',
        error: webhookResult.error,
        botInfo
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ botId, error: errorMsg }, 'Publish failed');

    await prisma.bot.update({
      where: { id: botId },
      data: {
        webhookStatus: 'WEBHOOK_FAILED',
        webhookError: errorMsg,
        webhookCheckedAt: new Date()
      }
    });

    return {
      success: false,
      webhookStatus: 'WEBHOOK_FAILED',
      error: errorMsg
    };
  }
};

/**
 * Send publish success message with bot username and open button
 */
const sendPublishSuccessMessage = async (
  token: string,
  chatId: number,
  botUsername: string
) => {
  const message = `✅ تم نشر البوت بنجاح!\n\n` +
    `🤖 البوت: @${botUsername}\n` +
    `🔗 رابط مباشر: t.me/${botUsername}\n\n` +
    `يمكنك الآن استخدام البوت أو مشاركته مع الآخرين.`;

  await sendMessage(token, chatId, message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 فتح البوت', url: `https://t.me/${botUsername}` }],
        [{ text: '📊 إدارة البوت', callback_data: 'mybots:manage' }]
      ]
    }
  });
};

/**
 * Send publish failure message with error details
 */
const sendPublishFailureMessage = async (
  token: string,
  chatId: number,
  error: string,
  botUsername?: string
) => {
  let message = `❌ فشل نشر البوت\n\n`;
  message += `السبب: ${error}\n\n`;

  if (botUsername) {
    message += `البوت: @${botUsername}\n\n`;
  }

  message += `💡 نصائح:\n`;
  message += `• تأكد من صحة توكن البوت\n`;
  message += `• تأكد من أن البوت غير محظور\n`;
  message += `• جرب إعادة النشر بعد دقيقة`;

  await sendMessage(token, chatId, message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 إعادة المحاولة', callback_data: 'draft:confirm_publish' }],
        [{ text: '🔙 رجوع', callback_data: 'draft:back' }]
      ]
    }
  });
};

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
  const traceId = randomUUID();
  let traceChatId: number | null = null;
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

    traceChatId = parsed.chatId ?? null;
    logger.info(
      { traceId, updateId: (update as { update_id?: number }).update_id, chatId: traceChatId, fromId: parsed.fromId },
      'Master webhook update received'
    );

    if ((!message && !callback) || !parsed.chatId || !parsed.fromId) {
      return res.json({ ok: true });
    }

    const chatId = parsed.chatId;

    const text = normalizeText(message?.text);
    const user = await ensureUser({
      id: parsed.fromId,
      first_name: message?.from?.first_name ?? callback?.from?.first_name ?? 'User',
      username: message?.from?.username ?? callback?.from?.username
    });

    const session = await getSession(user.id);

    if (parsed.callbackData) {
      if (!session?.data || !(session.data as { botId?: string }).botId) {
        logger.warn({ traceId, userId: user.id }, 'Callback received without session botId');
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'انتهت الجلسة الحالية. استخدم /create للبدء من جديد.'
        );
        return res.json({ ok: true });
      }
      const botId = (session.data as { botId?: string }).botId as string;
      const bot = await prisma.bot.findUnique({ where: { id: botId } });
      const draftFlow = await getDraftFlow(botId);
      if (!bot || !draftFlow) {
        logger.warn({ traceId, botId }, 'Draft bot or flow not found');
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'تعذر العثور على بيانات البوت المسودّة. حاول /create مرة أخرى.'
        );
        return res.json({ ok: true });
      }

      if (parsed.callbackData === 'draft:preview') {
        logger.info({ traceId, botId }, 'Entering preview mode');
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
        logger.info({ traceId, botId }, 'Opening edit menu');
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
        logger.info({ traceId, botId }, 'Publish requested');
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
        logger.info({ traceId, botId }, 'Returning to review screen');
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
        logger.info({ traceId, botId }, 'Editing welcome message');
        await setSession(user.id, SessionState.OWNER_EDIT_WELCOME, { botId });
        await sendMessage(MASTER_TOKEN, chatId, 'أرسل رسالة الترحيب الجديدة.');
        return res.json({ ok: true });
      }

      if (parsed.callbackData === 'draft:edit_menu') {
        logger.info({ traceId, botId }, 'Editing menu');
        await setSession(user.id, SessionState.OWNER_EDIT_MENU, { botId });
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'أرسل أسماء الأزرار الجديدة مفصولة بفواصل.'
        );
        return res.json({ ok: true });
      }

      if (parsed.callbackData === 'draft:edit_button') {
        logger.info({ traceId, botId }, 'Editing button');
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
        logger.info({ traceId, botId }, 'Regenerating blueprint');
        const pipelineStartedAt = Date.now();
        try {
          const pipelineResult = await runAgentPipeline({
            traceId,
            userId: user.id,
            chatId,
            messageText: bot.description ?? 'إعادة توليد البوت',
            sessionId: session?.id,
            sessionState: session?.state,
            currentBot: { id: bot.id, name: bot.name, description: bot.description },
            draftFlow
          });
          if (!pipelineResult.ok) {
            throw new Error(pipelineResult.errorMessage);
          }
          const pipeline = pipelineResult;
          await prisma.flow.update({
            where: { id: draftFlow.id },
            data: { blueprint: pipeline.blueprint as unknown as Prisma.InputJsonValue }
          });
          await prisma.agentRun.create({
            data: {
              traceId,
              userId: user.id,
              botId: bot.id,
              intent: pipeline.intent,
              inputText: bot.description ?? 'إعادة توليد البوت',
              planJson: pipeline.plan as unknown as Prisma.InputJsonValue,
              blueprintJson: pipeline.blueprint as unknown as Prisma.InputJsonValue,
              validatorErrors: pipeline.validatorErrors
                ? (pipeline.validatorErrors as unknown as Prisma.InputJsonValue)
                : Prisma.DbNull,
              status: 'SUCCESS',
              latencyMs: Date.now() - pipelineStartedAt
            }
          });
          await sendMessage(
            MASTER_TOKEN,
            chatId,
            `${pipeline.summary}\n\nتمت إعادة التوليد بنجاح.`
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error({ err: error, traceId, botId: bot.id }, 'Regenerate pipeline failed');
          await prisma.agentRun.create({
            data: {
              traceId,
              userId: user.id,
              botId: bot.id,
              intent: 'UNKNOWN',
              inputText: bot.description ?? 'إعادة توليد البوت',
              planJson: {} as Prisma.InputJsonValue,
              blueprintJson: {} as Prisma.InputJsonValue,
              validatorErrors: Prisma.DbNull,
              status: 'FAILED',
              errorMessage,
              latencyMs: Date.now() - pipelineStartedAt
            }
          });
          await sendMessage(
            MASTER_TOKEN,
            chatId,
            'صار خطأ مؤقت أثناء إعادة التوليد. حاول مرة ثانية.'
          );
        }
        return res.json({ ok: true });
      }

      if (parsed.callbackData?.startsWith('draft:select_button:')) {
        const index = Number(parsed.callbackData.split(':')[2]);
        logger.info({ traceId, botId, index }, 'Selected button to edit');
        await setSession(user.id, SessionState.OWNER_EDIT_BUTTON_LABEL, {
          botId,
          buttonIndex: index
        });
        await sendMessage(MASTER_TOKEN, chatId, 'أرسل النص الجديد للزر.');
        return res.json({ ok: true });
      }

      if (parsed.callbackData === 'draft:confirm_publish') {
        logger.info({ traceId, botId }, 'Publish confirmed');
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
        // Save to Knowledge Base (Self-Learning)
        try {
          const { LearningService } = await import('../services/learningService');
          await LearningService.saveExample(draftFlow.blueprint);
        } catch (e) {
          logger.error({ error: e }, 'Failed to save learning example');
        }

        logger.info({ traceId, botId }, 'Draft published without new token');
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
      logger.info({ traceId, userId: user.id }, 'Start command');
      await setSession(user.id, SessionState.IDLE);
      await sendMessage(
        MASTER_TOKEN,
        chatId,
        'مرحبا بك! استخدم /create لإنشاء بوت جديد أو /mybots لعرض بوتاتك.'
      );
      return res.json({ ok: true });
    }

    if (text === '/create') {
      logger.info({ traceId, userId: user.id }, 'Create command');
      await setSession(user.id, SessionState.AWAITING_DESCRIPTION);
      await sendMessage(
        MASTER_TOKEN,
        chatId,
        'اكتب وصف البوت المطلوب إنشاؤه.'
      );
      return res.json({ ok: true });
    }

    if (text === '/mybots') {
      logger.info({ traceId, userId: user.id }, 'List bots command');
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
      logger.info({ traceId, userId: user.id }, 'Received bot description');

      // Save User Message
      await prisma.chatMessage.create({
        data: { sessionId: session.id, role: 'user', content: text }
      });

      const pipelineStartedAt = Date.now();
      let pipeline;
      try {
        const pipelineResult = await runAgentPipeline({
          traceId,
          userId: user.id,
          chatId,
          messageText: text,
          sessionId: session.id,
          sessionState: session.state
        });
        if (!pipelineResult.ok) {
          throw new Error(pipelineResult.errorMessage);
        }
        pipeline = pipelineResult;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ err: error, traceId, userId: user.id }, 'Agent pipeline failed');
        await prisma.agentRun.create({
          data: {
            traceId,
            userId: user.id,
            intent: 'UNKNOWN',
            inputText: text,
            planJson: {} as Prisma.InputJsonValue,
            blueprintJson: {} as Prisma.InputJsonValue,
            validatorErrors: Prisma.DbNull,
            status: 'FAILED',
            errorMessage,
            latencyMs: Date.now() - pipelineStartedAt
          }
        });
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'صار خطأ مؤقت أثناء بناء البوت. حاول مرة ثانية.'
        );
        return res.json({ ok: true });
      }

      if (pipeline.intent === 'CONSULTATION') {
        // Update session with latent blueprint for potential feedback saving
        await setSession(user.id, session.state, { ...session.data as object, lastBlueprint: pipeline.blueprint });

        const assistantMsg = await prisma.chatMessage.create({
          data: { sessionId: session.id, role: 'assistant', content: pipeline.summary }
        });
        await sendMessage(MASTER_TOKEN, chatId, pipeline.summary, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '👍 نصيحة جيدة', callback_data: `feedback:good:${session.id}` },
                { text: '👎 غير مفيدة', callback_data: `feedback:bad:${session.id}` }
              ]
            ]
          }
        });
        return res.json({ ok: true });
      }

      if (parsed.callbackData?.startsWith('feedback:')) {
        const parts = parsed.callbackData.split(':');
        const type = parts[1]; // good | bad
        // const sessionId = parts[2]; // not strictly needed since we have user session

        logger.info({ traceId, userId: user.id, type }, 'User feedback received');

        if (type === 'good') {
          // Save to Knowledge Base
          const currentSession = await getSession(user.id);
          const blueprint = (currentSession?.data as any)?.lastBlueprint;
          if (blueprint) {
            try {
              const { LearningService } = await import('../services/learningService');
              await LearningService.saveExample(blueprint, 5); // 5 stars
              await sendMessage(MASTER_TOKEN, chatId, 'شكراً! تم حفظ الاقتراح لتحسين الردود القادمة. 🧠');
            } catch (e) {
              logger.error('Failed to save feedback example', e);
            }
          }
        } else {
          await sendMessage(MASTER_TOKEN, chatId, 'شكراً على ملاحظتك. سنحاول التحسن. 🙏');
        }
        return res.json({ ok: true });
      }

      const bot = await prisma.bot.create({
        data: {
          name: pipeline.blueprint.name ?? 'New Bot',
          description: text,
          ownerId: user.id,
          status: BotStatus.DRAFT,
          draftWelcomeText: 'مرحبا! اختر من القائمة.',
          draftMenuLabels: pipeline.blueprint.menu as unknown as Prisma.InputJsonValue,
          flows: {
            create: {
              name: 'v1',
              version: 1,
              blueprint: pipeline.blueprint as unknown as Prisma.InputJsonValue,
              status: 'DRAFT'
            }
          }
        }
      });

      await setSession(user.id, SessionState.AWAITING_REVIEW, { botId: bot.id });
      logger.info({ traceId, botId: bot.id }, 'Draft bot created');
      await prisma.agentRun.create({
        data: {
          traceId,
          userId: user.id,
          botId: bot.id,
          intent: pipeline.intent,
          inputText: text,
          planJson: pipeline.plan as unknown as Prisma.InputJsonValue,
          blueprintJson: pipeline.blueprint as unknown as Prisma.InputJsonValue,
          validatorErrors: pipeline.validatorErrors
            ? (pipeline.validatorErrors as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
          status: 'SUCCESS',
          latencyMs: Date.now() - pipelineStartedAt
        }
      });
      await sendMessage(
        MASTER_TOKEN,
        chatId,
        `${pipeline.summary}\n\nتم إنشاء البوت بنجاح 🎉\nهل ترغب بمراجعته قبل النشر؟`,
        { reply_markup: previewKeyboard }
      );

      await prisma.chatMessage.create({
        data: { sessionId: session.id, role: 'assistant', content: pipeline.summary }
      });

      return res.json({ ok: true });
    }

    if (session?.state === SessionState.OWNER_EDIT_WELCOME && !isCommand(text)) {
      const botId = (session.data as { botId?: string })?.botId;
      if (!botId) {
        logger.warn({ traceId, userId: user.id }, 'Missing botId for welcome edit');
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'حدث خطأ في تحديد البوت. استخدم /mybots أو /create.'
        );
        return res.json({ ok: true });
      }
      await prisma.bot.update({
        where: { id: botId },
        data: { draftWelcomeText: text }
      });
      logger.info({ traceId, botId }, 'Draft welcome updated');
      await setSession(user.id, SessionState.AWAITING_REVIEW, { botId });
      await sendMessage(MASTER_TOKEN, chatId, 'تم تحديث رسالة الترحيب (مسودة).');
      return res.json({ ok: true });
    }

    if (session?.state === SessionState.OWNER_EDIT_MENU && !isCommand(text)) {
      const botId = (session.data as { botId?: string })?.botId;
      if (!botId) {
        logger.warn({ traceId, userId: user.id }, 'Missing botId for menu edit');
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'حدث خطأ في تحديد البوت. استخدم /mybots أو /create.'
        );
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
      logger.info({ traceId, botId }, 'Draft menu updated');
      await setSession(user.id, SessionState.AWAITING_REVIEW, { botId });
      await sendMessage(MASTER_TOKEN, chatId, 'تم تحديث القائمة (مسودة).');
      return res.json({ ok: true });
    }

    if (session?.state === SessionState.OWNER_EDIT_BUTTON_LABEL && !isCommand(text)) {
      const data = session.data as { botId?: string; buttonIndex?: number };
      if (!data?.botId || data.buttonIndex === undefined) {
        logger.warn({ traceId, userId: user.id }, 'Missing button selection');
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'لم يتم العثور على الزر المحدد. استخدم /create أو /mybots.'
        );
        return res.json({ ok: true });
      }
      await setSession(user.id, SessionState.OWNER_EDIT_BUTTON_ACTION, {
        botId: data.botId,
        buttonIndex: data.buttonIndex,
        buttonLabel: text
      });
      logger.info({ traceId, botId: data.botId, buttonIndex: data.buttonIndex }, 'Button label updated');
      await sendMessage(MASTER_TOKEN, chatId, 'أرسل الرسالة/الوجهة الجديدة لهذا الزر.');
      return res.json({ ok: true });
    }

    if (session?.state === SessionState.OWNER_EDIT_BUTTON_ACTION && !isCommand(text)) {
      const data = session.data as { botId?: string; buttonIndex?: number; buttonLabel?: string };
      if (!data?.botId || data.buttonIndex === undefined || !data.buttonLabel) {
        logger.warn({ traceId, userId: user.id }, 'Missing button action context');
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'حدث خطأ أثناء تعديل الزر. جرّب /create أو /mybots.'
        );
        return res.json({ ok: true });
      }
      const bot = await prisma.bot.findUnique({ where: { id: data.botId } });
      const draftFlow = await getDraftFlow(data.botId);
      if (!bot || !draftFlow) {
        logger.warn({ traceId, botId: data.botId }, 'Draft flow missing during button action');
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'تعذر العثور على بيانات البوت المسودّة. جرّب /create مرة أخرى.'
        );
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
      logger.info({ traceId, botId: data.botId }, 'Button action updated');
      await setSession(user.id, SessionState.AWAITING_REVIEW, { botId: data.botId });
      await sendMessage(MASTER_TOKEN, chatId, 'تم تحديث الزر (مسودة).');
      return res.json({ ok: true });
    }

    if (session?.state === SessionState.PREVIEW_MODE && !isCommand(text)) {
      const botId = (session.data as { botId?: string })?.botId;
      if (!botId) {
        logger.warn({ traceId, userId: user.id }, 'Missing botId in preview mode');
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'انتهت جلسة المعاينة. استخدم /mybots للعودة.'
        );
        return res.json({ ok: true });
      }
      const bot = await prisma.bot.findUnique({ where: { id: botId } });
      const draftFlow = await getDraftFlow(botId);
      if (!bot || !draftFlow) {
        logger.warn({ traceId, botId }, 'Draft flow missing in preview mode');
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'تعذر العثور على بيانات البوت. استخدم /create للبدء.'
        );
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
      logger.info({ traceId, userId: user.id }, 'Received bot token');
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
        logger.warn({ traceId, userId: user.id }, 'Missing botId when receiving token');
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          'حدث خطأ. ابدأ من جديد باستخدام /create.'
        );
        return res.json({ ok: true });
      }

      // Validate token first
      let botInfo: TelegramUser;
      try {
        botInfo = await getMe(text);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'فشل التحقق';
        logger.warn({ traceId, botId, error: errorMsg }, 'Token validation failed');
        await sendMessage(
          MASTER_TOKEN,
          chatId,
          `❌ التوكن غير صالح: ${errorMsg}\n\nتأكد من نسخ التوكن كاملاً من @BotFather وحاول مرة أخرى.`
        );
        return res.json({ ok: true });
      }

      // Encrypt and save token
      const encrypted = encrypt(text);

      // Update bot with encrypted token
      const bot = await prisma.bot.update({
        where: { id: botId },
        data: {
          tokenCipherText: encrypted.cipherText,
          tokenIv: encrypted.iv,
          tokenTag: encrypted.tag,
          telegramUser: botInfo.username,
          telegramBotId: botInfo.id.toString()
        }
      });
      logger.info({ traceId, botId: bot.id, username: botInfo.username }, 'Bot token saved');

      // Publish flow
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
      logger.info({ traceId, botId }, 'Flow published and drafts finalized');

      // Publish with full webhook validation
      const publishResult = await publishBotWithValidation({
        botId,
        token: text,
        baseUrl: env.BASE_URL,
        webhookSecret: env.WEBHOOK_SECRET
      });

      await setSession(user.id, SessionState.IDLE);

      if (publishResult.success && publishResult.botUsername) {
        // Success - send message with bot link
        await sendPublishSuccessMessage(MASTER_TOKEN, chatId, publishResult.botUsername);
        logger.info({ traceId, botId, username: publishResult.botUsername }, 'Bot published successfully');
      } else {
        // Failed - send error message
        await sendPublishFailureMessage(
          MASTER_TOKEN,
          chatId,
          publishResult.error || 'خطأ غير معروف',
          publishResult.botUsername
        );
        logger.warn({ traceId, botId, error: publishResult.error }, 'Bot publish failed');
      }

      return res.json({ ok: true });
    }

    await sendMessage(
      MASTER_TOKEN,
      chatId,
      'أمر غير معروف. استخدم /start للبدء.'
    );
    return res.json({ ok: true });
  } catch (error) {
    logger.error({ err: error, traceId, chatId: traceChatId }, 'Master webhook handling failed');
    if (traceChatId) {
      try {
        await sendMessage(
          MASTER_TOKEN,
          traceChatId,
          'حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى أو أعد البدء باستخدام /start.'
        );
      } catch (sendError) {
        logger.error({ err: sendError, traceId, chatId: traceChatId }, 'Failed to send error message');
      }
    }
    return next(error);
  }
};
