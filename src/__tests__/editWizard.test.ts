import { describe, expect, it } from 'vitest';
import { editWizardAgent } from '../agents/editWizardAgent';
import { blueprintSchema } from '../agents/schemas';

const blueprint = blueprintSchema.parse({
  language: 'ar',
  welcome: 'مرحباً',
  menu: [
    { id: 'm1', title: 'AA', action: 'AA' },
    { id: 'm2', title: 'BB', action: 'BB' },
    { id: 'm3', title: 'CC', action: 'CC' }
  ],
  fallback: { id: 'fallback', message: 'fallback' }
});

describe('edit wizard', () => {
  it('updates menu label', () => {
    const updated = editWizardAgent(blueprint, { type: 'rename', menuId: 'm1', value: 'AA' });
    expect(updated.menu[0].title).toBe('AA');
  });
});
