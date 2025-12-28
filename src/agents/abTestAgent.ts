import { Blueprint, Plan, blueprintSchema } from './schemas';
import { evaluatorAgent } from './evaluatorAgent';

const buildVariant = (plan: Plan, language: 'ar' | 'en', count: number): Blueprint => {
  const menus = plan.mainMenus.slice(0, count).map((title, index) => ({
    id: `menu_${index + 1}`,
    title,
    action: title
  }));

  return blueprintSchema.parse({
    language,
    welcome: language === 'ar' ? 'مرحباً بك' : 'Welcome',
    menu: menus,
    fallback: { id: 'fallback', message: language === 'ar' ? 'عذراً' : 'Sorry' }
  });
};

export const abTestAgent = (plan: Plan, language: 'ar' | 'en') => {
  const variantA = buildVariant(plan, language, Math.min(5, plan.mainMenus.length));
  const variantB = buildVariant(plan, language, Math.min(8, Math.max(5, plan.mainMenus.length)));

  const scoreA = evaluatorAgent(variantA).score;
  const scoreB = evaluatorAgent(variantB).score;

  const winner = (scoreA >= scoreB ? 'A' : 'B') as 'A' | 'B';

  return { variantA, variantB, scoreA, scoreB, winner };
};
