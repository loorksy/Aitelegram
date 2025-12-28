import { Bot, User } from '@prisma/client';

export interface TelegramMessage {
    message_id: number;
    text?: string;
    photo?: unknown[];
    video?: unknown;
    document?: unknown;
    voice?: unknown;
    new_chat_members?: unknown[];
    left_chat_member?: unknown;
    chat: { id: number; type: string };
    from: { id: number; first_name: string; username?: string };
}

export interface SkillContext {
    bot: Bot;
    user: User;
    token: string;
    chatId: number;
    message?: TelegramMessage;
    callback?: { data?: string; id: string };
    sessionId?: string;
}

export interface Skill {
    key: string; // e.g., 'media_downloader', 'group_admin'
    description: string;
    handle(ctx: SkillContext): Promise<boolean>; // Returns true if handled
}
