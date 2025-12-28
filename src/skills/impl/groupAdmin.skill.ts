import { Skill, SkillContext } from '../types';
import { sendMessage, deleteMessage } from '../../core/telegram';

export const groupAdminSkill: Skill = {
    key: 'group_admin',
    description: 'Manage group interactions (welcome, anti-spam)',

    async handle(ctx: SkillContext): Promise<boolean> {
        // 1. Handle New Chat Members
        if (ctx.message?.new_chat_members && ctx.message.new_chat_members.length > 0) {
            await sendMessage(ctx.token, ctx.chatId, 'مرحباً بكم في المجموعة! 👋');
            return true;
        }

        // 2. Anti-Spam / Bad Words (Simple/Mock)
        if (ctx.message?.text) {
            const badWords = ['spam', 'buy crypto', 'pussy']; // Example
            const text = ctx.message.text.toLowerCase();
            if (badWords.some(w => text.includes(w))) {
                // Delete message
                // Need message_id for deletion. In types it wasn't explicit but usually in message object.
                // I will assume message object has message_id based on previous handler code.
                // Ideally I should update the types.ts to include message_id
                /* 
                   Note: In types.ts I defined TelegramMessage without message_id. 
                   But at runtime it's there. 
                   I'll cast it for now or update types.ts later.
                */
                const msgId = ctx.message.message_id;
                if (msgId) {
                    await deleteMessage(ctx.token, ctx.chatId, msgId);
                    await sendMessage(ctx.token, ctx.chatId, `🚫 تم حذف رسالة مخالفة من ${ctx.message.from.first_name}`);
                    return true;
                }
            }
        }

        return false;
    }
};
