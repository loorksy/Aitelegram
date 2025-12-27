import { describe, expect, it } from 'vitest';
import { validatorAgent } from '../agents/validatorAgent';
import { blueprintSchema } from '../agents/schemas';

const blueprint = blueprintSchema.parse({
  language: 'en',
  welcome: 'Welcome',
  menu: [
    { id: 'm1', title: 'AA', action: 'AA' },
    { id: 'm1', title: 'BB', action: 'BB' },
    { id: 'm3', title: 'CC', action: 'CC' }
  ],
  fallback: { id: 'fallback', message: 'fallback' }
});

describe('validator agent', () => {
  it('detects duplicate ids', () => {
    const result = validatorAgent(blueprint);
    expect(result.report.ok).toBe(false);
    expect(result.report.issues).toContain('duplicate_menu_id');
  });
});
