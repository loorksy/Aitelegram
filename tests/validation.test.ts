import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { z } from 'zod';

// Schemas from agentOrchestrator
const IntentSchema = z.object({
  intent: z.enum(['CREATE_BOT', 'EDIT_BOT', 'PUBLISH_BOT', 'HELP', 'UNKNOWN']),
  confidence: z.number().min(0).max(1)
});

const PlanSchema = z.object({
  steps: z.array(z.string().min(1).transform((value) => value.trim())).min(1),
  assumptions: z.array(z.string().min(1).transform((value) => value.trim())).default([])
});

const BlueprintSchema = z.object({
  name: z.string().min(3).max(60).transform((value) => value.trim()),
  description: z.string().min(5).max(200).transform((value) => value.trim()),
  menu: z
    .array(
      z.object({
        title: z.string().min(1).max(20).transform((value) => value.trim()),
        action: z.string().min(1).max(200).transform((value) => value.trim())
      })
    )
    .min(3)
    .max(7)
});

describe('Zod Schema Validation', () => {
  describe('IntentSchema', () => {
    it('should validate correct intent', () => {
      const result = IntentSchema.safeParse({
        intent: 'CREATE_BOT',
        confidence: 0.95
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid intent', () => {
      const result = IntentSchema.safeParse({
        intent: 'INVALID',
        confidence: 0.5
      });
      expect(result.success).toBe(false);
    });

    it('should reject confidence out of range', () => {
      const result = IntentSchema.safeParse({
        intent: 'CREATE_BOT',
        confidence: 1.5
      });
      expect(result.success).toBe(false);
    });
  });

  describe('PlanSchema', () => {
    it('should validate correct plan', () => {
      const result = PlanSchema.safeParse({
        steps: ['Step 1', 'Step 2', 'Step 3'],
        assumptions: ['Assumption 1']
      });
      expect(result.success).toBe(true);
    });

    it('should default assumptions to empty array', () => {
      const result = PlanSchema.safeParse({
        steps: ['Step 1']
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assumptions).toEqual([]);
      }
    });

    it('should reject empty steps', () => {
      const result = PlanSchema.safeParse({
        steps: []
      });
      expect(result.success).toBe(false);
    });

    it('should trim whitespace from steps', () => {
      const result = PlanSchema.safeParse({
        steps: ['  Step 1  ', 'Step 2']
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.steps[0]).toBe('Step 1');
      }
    });
  });

  describe('BlueprintSchema', () => {
    it('should validate correct blueprint', () => {
      const result = BlueprintSchema.safeParse({
        name: 'بوت خدمة العملاء',
        description: 'بوت ذكي للرد على استفسارات العملاء',
        menu: [
          { title: 'الأسئلة الشائعة', action: 'عرض الأسئلة' },
          { title: 'الدعم الفني', action: 'تواصل مع الدعم' },
          { title: 'معلومات', action: 'عرض المعلومات' }
        ]
      });
      expect(result.success).toBe(true);
    });

    it('should reject name too short', () => {
      const result = BlueprintSchema.safeParse({
        name: 'AB',
        description: 'Valid description here',
        menu: [
          { title: 'Item 1', action: 'Action 1' },
          { title: 'Item 2', action: 'Action 2' },
          { title: 'Item 3', action: 'Action 3' }
        ]
      });
      expect(result.success).toBe(false);
    });

    it('should reject menu with less than 3 items', () => {
      const result = BlueprintSchema.safeParse({
        name: 'Valid Bot Name',
        description: 'Valid description here',
        menu: [
          { title: 'Item 1', action: 'Action 1' },
          { title: 'Item 2', action: 'Action 2' }
        ]
      });
      expect(result.success).toBe(false);
    });

    it('should reject menu with more than 7 items', () => {
      const result = BlueprintSchema.safeParse({
        name: 'Valid Bot Name',
        description: 'Valid description here',
        menu: Array(8).fill({ title: 'Item', action: 'Action' })
      });
      expect(result.success).toBe(false);
    });

    it('should trim whitespace from all fields', () => {
      const result = BlueprintSchema.safeParse({
        name: '  Bot Name  ',
        description: '  Description  ',
        menu: [
          { title: '  Title 1  ', action: '  Action 1  ' },
          { title: 'Title 2', action: 'Action 2' },
          { title: 'Title 3', action: 'Action 3' }
        ]
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Bot Name');
        expect(result.data.description).toBe('Description');
        expect(result.data.menu[0].title).toBe('Title 1');
      }
    });
  });
});
