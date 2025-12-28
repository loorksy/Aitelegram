import { Router } from 'express';
import { prisma } from '../core/prisma';

const router = Router();

// Get bot stats
router.get('/bots/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;
        // Basic verification - better to move to middleware
        const bot = await prisma.bot.findUnique({ where: { id } });
        if (!bot) return res.status(404).json({ ok: false, error: 'Bot not found' });

        // 1. Total Users
        const totalUsers = await prisma.session.count({
            where: { botId: id }
        });

        // 2. Active Users (last 24h interactions)
        const activeLast24h = await prisma.agentRun.count({
            where: {
                botId: id,
                createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
        });

        res.json({
            ok: true,
            stats: {
                totalUsers,
                activeLast24h,
                uniqueInteractions: 0 // Placeholder
            }
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: 'Internal error' });
    }
});

// Update bot content (manual editing)
router.put('/bots/:id/content', async (req, res) => {
    try {
        const { id } = req.params;
        const { welcomeText, menuLabels, description } = req.body;

        const bot = await prisma.bot.findUnique({ where: { id } });
        if (!bot) return res.status(404).json({ ok: false, error: 'Bot not found' });

        // Update Bot record (Draft fields)
        await prisma.bot.update({
            where: { id },
            data: {
                draftWelcomeText: welcomeText,
                draftMenuLabels: menuLabels, // Expecting JSON array
                description: description, // Update description if provided
                updatedAt: new Date()
            }
        });

        // Also update the latest Draft Flow if exists, to keep sync
        const latestFlow = await prisma.flow.findFirst({
            where: { botId: id, status: 'DRAFT' },
            orderBy: { createdAt: 'desc' }
        });

        if (latestFlow) {
            const blueprint = latestFlow.blueprint as any;
            if (menuLabels) blueprint.menu = menuLabels;
            if (description) blueprint.description = description;

            await prisma.flow.update({
                where: { id: latestFlow.id },
                data: { blueprint }
            });
        }

        res.json({ ok: true, message: 'Content updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, error: 'Internal error' });
    }
});

export default router;
