import { describe, expect, it } from 'vitest';
import { buildMenuKeyboard, handleNavigation } from '../core/flowEngine';

describe('flow navigation', () => {
  it('handles back and home navigation', () => {
    const stack = ['a', 'b'];
    expect(handleNavigation('back', stack)).toEqual(['a']);
    expect(handleNavigation('home', stack)).toEqual([]);
  });

  it('builds keyboard with navigation buttons', () => {
    const keyboard = buildMenuKeyboard([
      { title: 'A', action: 'a' },
      { title: 'B', action: 'b' }
    ]);
    const rows = keyboard.inline_keyboard;
    const navRow = rows[rows.length - 1];
    expect(navRow[0].text).toBe('🏠 الرئيسية');
    expect(navRow[1].text).toBe('◀️ رجوع');
  });
});
