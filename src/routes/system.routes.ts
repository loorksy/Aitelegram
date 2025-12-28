import { Router } from 'express';
import { prisma } from '../core/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Middleware to check for ADMIN role
const requireAdmin = async (req: any, res: any, next: any) => {
    // Mock auth check for now, real implementation relies on useAuthStore + token
    // In real world, we check req.user.role === 'OWNER' | 'ADMIN'
    next();
};

// Get System Health
router.get('/admin/system/health', requireAdmin, async (req, res) => {
    try {
        // Mock system stats
        const health = {
            cpu: Math.floor(Math.random() * 30) + 10, // 10-40%
            memory: Math.floor(Math.random() * 40) + 20, // 20-60%
            uptime: process.uptime(),
            activeWebhooks: await prisma.bot.count({ where: { webhookStatus: 'WEBHOOK_OK' } }),
            totalBots: await prisma.bot.count(),
            totalUsers: await prisma.user.count()
        };
        res.json({ ok: true, health });
    } catch (error) {
        res.status(500).json({ ok: false, error: 'Failed to fetch health' });
    }
});

// Update Global Config (e.g. Cost per run)
router.patch('/admin/system/config', requireAdmin, async (req, res) => {
    try {
        const { key, value } = req.body;
        // Validate key
        if (key !== 'PIPELINE_COST') {
            return res.status(400).json({ ok: false, error: 'Invalid config key' });
        }

        const config = await prisma.systemConfig.upsert({
            where: { key },
            update: { value },
            create: { key, value }
        });

        logger.info({ key, value, adminId: 'ADMIN' }, 'System config updated');
        res.json({ ok: true, config });
    } catch (error) {
        res.status(500).json({ ok: false, error: 'Failed to update config' });
    }
});

export default router;
