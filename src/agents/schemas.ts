import { z } from 'zod';

export const planSchema = z.object({
  botPurpose: z.string().min(3),
  targetAudience: z.string().min(3),
  mainMenus: z.array(z.string().min(2)).min(3).max(7),
  actionsNeeded: z.array(z.string().min(2)).min(1),
  dataNeeds: z.array(z.string().min(2)).default([])
});

export const blueprintSchema = z.object({
  language: z.enum(['ar', 'en']).default('ar'),
  welcome: z.string().min(3),
  menu: z.array(
    z.object({
      id: z.string().min(2),
      title: z.string().min(2),
      action: z.string().min(2)
    })
  ).min(3).max(8),
  fallback: z.object({
    id: z.string().min(2),
    message: z.string().min(3)
  }),
  // Phase 2: Advanced Capabilities
  skills: z.array(z.string()).default([]), // e.g. ['media_downloader', 'group_admin']
  triggers: z.array(z.object({
    type: z.enum(['message', 'photo', 'video', 'document', 'voice', 'new_chat_member', 'left_chat_member']),
    action: z.string()
  })).default([]),
  config: z.record(z.unknown()).default({}) // e.g. { "allowed_domains": ["tiktok.com"] }
});

export const validationReportSchema = z.object({
  ok: z.boolean(),
  issues: z.array(z.string()).default([]),
  repaired: z.boolean().default(false)
});

export const evaluatorSchema = z.object({
  score: z.number().min(0).max(100),
  breakdown: z.object({
    clarity: z.number().min(0).max(100),
    completeness: z.number().min(0).max(100),
    safety: z.number().min(0).max(100),
    ux: z.number().min(0).max(100),
    i18n: z.number().min(0).max(100)
  }),
  reasons: z.array(z.string()),
  action: z.enum(['approve', 'regenerate'])
});

export const previewSchema = z.object({
  message: z.string().min(3),
  warnings: z.array(z.string()).default([])
});

export const opsSchema = z.object({
  ready: z.boolean(),
  checks: z.array(z.object({
    name: z.string(),
    ok: z.boolean()
  })),
  blocking: z.array(z.string()).default([])
});

export type Plan = z.infer<typeof planSchema>;
export type Blueprint = z.infer<typeof blueprintSchema>;
export type ValidationReport = z.infer<typeof validationReportSchema>;
export type EvaluatorReport = z.infer<typeof evaluatorSchema>;
export type PreviewReport = z.infer<typeof previewSchema>;
export type OpsReport = z.infer<typeof opsSchema>;
