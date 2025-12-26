import { describe, expect, it } from 'vitest';
import { planSchema, blueprintSchema, evaluatorSchema } from '../agents/schemas';

const plan = {
  botPurpose: 'Support bot',
  targetAudience: 'customers',
  mainMenus: ['Home', 'Support', 'FAQ'],
  actionsNeeded: ['answer'],
  dataNeeds: []
};

const blueprint = {
  language: 'en',
  welcome: 'Welcome',
  menu: [
    { id: 'm1', title: 'Home', action: 'Home' },
    { id: 'm2', title: 'Support', action: 'Support' },
    { id: 'm3', title: 'FAQ', action: 'FAQ' }
  ],
  fallback: { id: 'fallback', message: 'Fallback' }
};

const evaluator = {
  score: 80,
  breakdown: { clarity: 80, completeness: 80, safety: 90, ux: 80, i18n: 80 },
  reasons: ['ok'],
  action: 'approve'
};

describe('agent schemas', () => {
  it('validates plan schema', () => {
    expect(planSchema.parse(plan)).toBeDefined();
  });

  it('validates blueprint schema', () => {
    expect(blueprintSchema.parse(blueprint)).toBeDefined();
  });

  it('validates evaluator schema', () => {
    expect(evaluatorSchema.parse(evaluator)).toBeDefined();
  });
});
