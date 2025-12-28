import { BotStatus, InteractionType, ModerationMode, SessionState } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import { buildMenuKeyboard, handleNavigation, sendMenuItemMessage, LinkButton } from '../core/flowEngine';
import {
  answerCallbackQuery,
  banChatMember,
  deleteMessage,
  restrictChatMember,
  sendMedia,
  sendMessage
} from '../core/telegram';
import { checkModeration } from '../core/moderation';
import { getBotWithToken, updateBotStatus } from '../services/bot.service';
import { createLog } from '../services/log.service';
import { getMediaById, incrementUsage } from '../services/media.service';
import { getOrCreateSession, updateSession } from '../services/session.service';
import { handleOwnerPanel } from './ownerPanel.handler';
import { getLinkById, incrementClick, listLinks } from '../services/externalLink.service';
import { getGroupByChat, linkGroupToBot } from '../services/botGroup.service';
import { incrementWarn, markBanned } from '../services/groupMember.service';
import { prisma } from '../core/prisma';
import { recordInteraction } from '../services/analytics.service';
import { parseTelegramUpdate } from '../core/telegramUpdateParser';
import { logger } from '../utils/logger';
import { skillManager } from '../skills/skillManager';
import { SkillContext } from '../skills/types';

/**
 * Ensure user exists before creating session - fixes P2003 FK constraint
 */
const ensureUserForBot = async (telegramId: string, firstName?: string, username?: string) => {
  return prisma.user.upsert({
    where: { telegramId },
    update: {
      name: firstName || undefined,
      username: username || undefined
    },
    create: {
      telegramId,
      name: firstName || 'User',
      username: username || undefined
    }
  });
};

export const userBotHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { botId } = req.params;
    const update = req.body as Record<string, unknown>;
    const parsed = (req as Request & { telegramUpdate?: ReturnType<typeof parseTelegramUpdate> }).telegramUpdate
      ?? parseTelegramUpdate(update);
    const message = update.message as {
      text?: string;
      message_id?: number;
      from?: { id: number; first_name: string; username?: string };
      chat?: { id: number; type?: string; title?: string };
    } | undefined;
    const callback = update.callback_query as {
      id: string;
      data?: string;
      from?: { id: number };
      message?: { chat?: { id: number; type?: string } };
    } | undefined;

    const payload = message ?? callback?.message;
    if (!payload || !parsed.chatId || !parsed.fromId) {
      return res.json({ ok: true });
    }

    const chatId = parsed.chatId;
    const fromId = parsed.fromId;
    if (!fromId) {
      return res.json({ ok: true });
    }

    const result = await getBotWithToken(botId);
    if (!result || !result.bot || !result.token || !result.flow) {
      return res.json({ ok: true });
    }
    const { bot, token, flow } = result;

    if (bot.status === BotStatus.OFFLINE) {
      return res.json({ ok: true });
    }

    // Allow WEBHOOK_OK status as well as PUBLISHED
    const isPublishedOrOk = bot.status === BotStatus.PUBLISHED ||
      bot.status === BotStatus.WEBHOOK_OK;

    if (!isPublishedOrOk) {
      const isOwner = bot.ownerId === fromId.toString();
      if (!isOwner) {
        return res.json({ ok: true });
      }
    }

    // CRITICAL FIX: Ensure user exists before creating session (fixes P2003)
    const telegramUser = message?.from ?? callback?.from;
    const user = await ensureUserForBot(
      fromId.toString(),
      telegramUser ? (telegramUser as { first_name?: string }).first_name : undefined,
      telegramUser ? (telegramUser as { username?: string }).username : undefined
    );
    logger.debug({ userId: user.id, telegramId: fromId }, 'User ensured for bot interaction');

    // ==================== SKILL PROCESSING (PHASE 2) ====================
    const blueprint = flow.blueprint as { skills?: string[] };
    if (blueprint.skills && blueprint.skills.length > 0) {
      const skillContext: SkillContext = {
        bot,
        user,
        token,
        chatId,
        message: message as any,
        callback: callback ? { data: callback.data, id: callback.id } : undefined,
        sessionId: undefined // Set below if needed
      };

      const handled = await skillManager.process(skillContext, blueprint.skills);
      if (handled) {
        return res.json({ ok: true });
      }
    }
    // ===================================================================

    const menuItems = (bot.menuLabels as Array<{ title: string; action: string; mediaId?: string; nodeId?: string }>) ??
      (flow.blueprint as { menu: Array<{ title: string; action: string; mediaId?: string; nodeId?: string }> }).menu ?? [];

    const buildLinkButtons = async (nodeId: string) => {
      const links = await listLinks(bot.id, nodeId);
      return links
        .filter((link) => link.isActive)
        .map<LinkButton>((link) => ({
          text: link.label,
          callback_data: `link:${link.id}`
        }));
    };

    const session = await getOrCreateSession(user.id, bot.id, chatId.toString());
    const sessionData = (session.data as { stack?: string[] }) ?? { stack: [] };

    const chatType = parsed.chatType ?? payload.chat?.type ?? 'private';
    const isGroup = chatType === 'group' || chatType === 'supergroup';

    if (isGroup && message?.text?.startsWith('/link')) {
      const parts = message.text.split(' ');
      const targetBotId = parts[1] ?? bot.id;
      const owner = await prisma.user.findUnique({ where: { telegramId: fromId.toString() } });
      const ownsBot = owner
        ? await prisma.bot.findFirst({
          where: { id: targetBotId, ownerId: owner.id }
        })
        : null;
      if (!ownsBot) {
        await sendMessage(token, chatId, 'ليس لديك صلاحية لربط هذه المجموعة.');
        return res.json({ ok: true });
      }
      await linkGroupToBot({
        botId: targetBotId,
        chatId: chatId.toString(),
        title: message?.chat?.title ?? undefined,
        moderationMode: ModerationMode.MANUAL
      });
      await sendMessage(token, chatId, 'تم ربط المجموعة بالبوت بنجاح.');
      return res.json({ ok: true });
    }

    if (isGroup && message?.text) {
      const group = await getGroupByChat(bot.id, chatId.toString());
      if (group && group.moderationMode !== ModerationMode.MANUAL) {
        const moderation = await checkModeration(message.text);
        if (moderation.flagged) {
          if (message.message_id) {
            await deleteMessage(token, chatId, message.message_id);
          }
          const warning = await incrementWarn(group.id, fromId.toString());
          if (warning.warns >= 3) {
            await banChatMember(token, chatId, fromId);
            await markBanned(group.id, fromId.toString());
            await sendMessage(token, chatId, 'تم حظر المستخدم بسبب المخالفات المتكررة.');
          } else {
            const untilDate = Math.floor(Date.now() / 1000) + 300;
            await restrictChatMember(token, chatId, fromId, untilDate);
            await sendMessage(
              token,
              chatId,
              `تحذير للمستخدم. عدد التحذيرات: ${warning.warns}/3`
            );
          }
          return res.json({ ok: true });
        }
      }
    }

    if (message?.text === '/start') {
      await updateSession(session.id, SessionState.USER_FLOW, { stack: [] });
      const linkButtons = await buildLinkButtons('root');
      await sendMessage(token, chatId, bot.welcomeText ?? 'مرحبا!', {
        reply_markup: buildMenuKeyboard(
          menuItems,
          bot.ownerId === fromId.toString(),
          linkButtons
        )
      });
      await recordInteraction({
        botId: bot.id,
        userId: fromId.toString(),
        type: InteractionType.START
      });
      await recordInteraction({
        botId: bot.id,
        userId: fromId.toString(),
        type: InteractionType.MENU_VIEW,
        nodeId: 'root'
      });
      await createLog(bot.id, 'info', 'User started bot', { userId: fromId });
      return res.json({ ok: true });
    }

    if (callback?.data?.startsWith('owner:')) {
      const isOwner = bot.ownerId === fromId.toString();
      if (!isOwner) {
        return res.json({ ok: true });
      }

      if (callback.data === 'owner:toggle') {
        const nextStatus = bot.status === BotStatus.PUBLISHED ? BotStatus.OFFLINE : BotStatus.PUBLISHED;
        await updateBotStatus(bot.id, nextStatus);
        await sendMessage(
          token,
          chatId,
          `تم ضبط الحالة إلى ${nextStatus}.`
        );
        await createLog(bot.id, 'ADMIN_ACTION', 'Owner toggled bot status');
        return res.json({ ok: true });
      }

      await handleOwnerPanel({
        token,
        chatId,
        botId: bot.id,
        menuItems,
        callbackData: callback.data,
        sessionId: session.id
      });
      return res.json({ ok: true });
    }

    if (session.state === SessionState.OWNER_EDIT_WELCOME && message?.text) {
      await handleOwnerPanel({
        token,
        chatId,
        botId: bot.id,
        menuItems,
        sessionId: session.id,
        messageText: message.text,
        mode: 'OWNER_EDIT_WELCOME'
      });
      return res.json({ ok: true });
    }

    if (session.state === SessionState.OWNER_EDIT_MENU && message?.text) {
      await handleOwnerPanel({
        token,
        chatId,
        botId: bot.id,
        menuItems,
        sessionId: session.id,
        messageText: message.text,
        mode: 'OWNER_EDIT_MENU'
      });
      return res.json({ ok: true });
    }

    if (session.state === SessionState.OWNER_BROADCAST_NOW && message?.text) {
      await handleOwnerPanel({
        token,
        chatId,
        botId: bot.id,
        menuItems,
        sessionId: session.id,
        messageText: message.text,
        mode: 'OWNER_BROADCAST_NOW'
      });
      return res.json({ ok: true });
    }

    if (session.state === SessionState.OWNER_SCHEDULE_BROADCAST && message?.text) {
      await handleOwnerPanel({
        token,
        chatId,
        botId: bot.id,
        menuItems,
        sessionId: session.id,
        messageText: message.text,
        mode: 'OWNER_SCHEDULE_BROADCAST'
      });
      return res.json({ ok: true });
    }

    if (callback?.data === 'nav:home') {
      const updatedStack = handleNavigation('home', sessionData.stack ?? []);
      await updateSession(session.id, SessionState.USER_FLOW, { stack: updatedStack });
      const linkButtons = await buildLinkButtons('root');
      await sendMessage(token, chatId, bot.welcomeText ?? 'مرحبا!', {
        reply_markup: buildMenuKeyboard(
          menuItems,
          bot.ownerId === fromId.toString(),
          linkButtons
        )
      });
      await recordInteraction({
        botId: bot.id,
        userId: fromId.toString(),
        type: InteractionType.MENU_VIEW,
        nodeId: 'root'
      });
      return res.json({ ok: true });
    }

    if (callback?.data === 'nav:back') {
      const updatedStack = handleNavigation('back', sessionData.stack ?? []);
      await updateSession(session.id, SessionState.USER_FLOW, { stack: updatedStack });
      const linkButtons = await buildLinkButtons('root');
      await sendMessage(token, chatId, bot.welcomeText ?? 'رجوع', {
        reply_markup: buildMenuKeyboard(
          menuItems,
          bot.ownerId === fromId.toString(),
          linkButtons
        )
      });
      await recordInteraction({
        botId: bot.id,
        userId: fromId.toString(),
        type: InteractionType.MENU_VIEW,
        nodeId: 'root'
      });
      return res.json({ ok: true });
    }

    if (callback?.data?.startsWith('link:')) {
      const linkId = callback.data.split(':')[1];
      const link = await getLinkById(linkId);
      if (link) {
        await incrementClick(link.id);
        await answerCallbackQuery(token, callback.id, 'تم تسجيل الضغط');
        const resolvedUrl =
          link.type === 'OPEN_WEBAPP'
            ? link.webAppUrl ?? link.url
            : link.type === 'LOGIN'
              ? link.loginUrl ?? link.url
              : link.url;
        await sendMessage(token, chatId, resolvedUrl);
      }
      return res.json({ ok: true });
    }

    if (callback?.data?.startsWith('menu:')) {
      const index = Number(callback.data.split(':')[1]);
      const item = menuItems[index];
      if (item) {
        sessionData.stack?.push(item.title);
        await updateSession(session.id, SessionState.USER_FLOW, sessionData);
        await recordInteraction({
          botId: bot.id,
          userId: fromId.toString(),
          type: InteractionType.BUTTON_CLICK,
          nodeId: item.nodeId ?? `menu:${index}`
        });
        if (item.mediaId) {
          const media = await getMediaById(item.mediaId);
          if (media) {
            await sendMedia({
              token,
              chatId,
              type: media.type as 'photo' | 'video' | 'document',
              filePath: media.filePath,
              caption: item.action
            });
            await incrementUsage(media.id);
          } else {
            await sendMessage(token, chatId, 'الوسائط غير متاحة.');
          }
        } else {
          await sendMenuItemMessage(token, chatId, item);
        }
        await createLog(bot.id, 'info', 'Menu action executed', {
          item: item.title,
          userId: fromId
        });
        const nodeId = item.nodeId ?? `menu:${index}`;
        const linkButtons = await buildLinkButtons(nodeId);
        await sendMessage(token, chatId, 'اختر من القائمة:', {
          reply_markup: buildMenuKeyboard(
            menuItems,
            bot.ownerId === fromId.toString(),
            linkButtons
          )
        });
        await recordInteraction({
          botId: bot.id,
          userId: fromId.toString(),
          type: InteractionType.MENU_VIEW,
          nodeId
        });
      }
      return res.json({ ok: true });
    }

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
};
