import { PrismaClient, KnowledgeBaseType } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export type BlueprintExample = {
    name: string;
    description: string;
    skills: string[];
    blueprint: any;
};

export class LearningService {
    /**
     * Save a successful blueprint as a learning example.
     * @param blueprint The bot blueprint
     * @param rating Optional rating (e.g. from user thumbs up)
     */
    static async saveExample(blueprint: any, rating: number = 1): Promise<void> {
        try {
            const skills = blueprint.skills || [];
            const tags = [...skills, blueprint.name, 'example'];

            await prisma.knowledgeBaseItem.create({
                data: {
                    type: KnowledgeBaseType.EXAMPLE,
                    title: blueprint.name,
                    content: JSON.stringify(blueprint),
                    tags: tags,
                    language: 'ar',
                    updatedAt: new Date()
                }
            });

            logger.info(`Saved learning example: ${blueprint.name}`);
        } catch (error) {
            logger.error('Failed to save learning example', error);
        }
    }

    /**
     * Find similar blueprints to help the agent.
     * Uses simple keyword matching on tags/content for MVP.
     */
    static async findSimilarExamples(query: string): Promise<BlueprintExample[]> {
        try {
            // MVP: Simple search. In production, use pgvector or embeddings.
            // We search for items where title or content contains parts of the query.

            // 1. Extract potential keywords (very basic)
            const keywords = query.split(' ').filter(w => w.length > 3).slice(0, 3);

            if (keywords.length === 0) return [];

            const OR_CONDITIONS = keywords.map(w => ({
                OR: [
                    { title: { contains: w } }, // Case insensitive usually depends on DB collation
                    { tags: { has: w } }
                ]
            }));

            const items = await prisma.knowledgeBaseItem.findMany({
                where: {
                    type: KnowledgeBaseType.EXAMPLE,
                    OR: OR_CONDITIONS.flatMap(c => c.OR)
                },
                take: 3,
                orderBy: { updatedAt: 'desc' }
            });

            return items.map(item => {
                try {
                    const bp = JSON.parse(item.content);
                    return {
                        name: item.title,
                        description: bp.description,
                        skills: bp.skills || [],
                        blueprint: bp
                    };
                } catch (e) {
                    return null;
                }
            }).filter(Boolean) as BlueprintExample[];

        } catch (error) {
            logger.error('Failed to find similar examples', error);
            return [];
        }
    }
}
