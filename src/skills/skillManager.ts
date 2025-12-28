import { Skill, SkillContext } from './types';
import { logger } from '../utils/logger';
import { groupAdminSkill } from './impl/groupAdmin.skill';
import { mediaSkill } from './impl/media.skill';

class SkillManager {
    private skills: Map<string, Skill> = new Map();

    constructor() {
        this.register(groupAdminSkill);
        this.register(mediaSkill);
    }

    register(skill: Skill) {
        this.skills.set(skill.key, skill);
        logger.info({ skill: skill.key }, 'Skill registered');
    }

    getSkill(key: string) {
        return this.skills.get(key);
    }

    /**
     * Process skills for a given context.
     * Returns true if a skill handled the request and we should stop further processing.
     */
    async process(context: SkillContext, enabledSkills: string[] = []): Promise<boolean> {
        for (const skillKey of enabledSkills) {
            const skill = this.skills.get(skillKey);
            if (!skill) continue;

            try {
                const handled = await skill.handle(context);
                if (handled) {
                    logger.info(
                        { skill: skillKey, botId: context.bot.id, userId: context.user.id },
                        'Request handled by skill'
                    );
                    return true;
                }
            } catch (error) {
                logger.error(
                    { err: error, skill: skillKey, botId: context.bot.id },
                    'Skill execution failed'
                );
            }
        }
        return false;
    }
}

export const skillManager = new SkillManager();
