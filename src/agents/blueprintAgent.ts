import { blueprintSchema, Blueprint, Plan } from './schemas';

const buildMenu = (titles: string[]) =>
  titles.map((title, index) => ({
    id: `menu_${index + 1}`,
    title,
    action: title
  }));

export const blueprintAgent = (plan: Plan, language: 'ar' | 'en', template: string) => {
  const baseMenus = plan.mainMenus;
  const menu = buildMenu(baseMenus);

  const welcome = language === 'ar'
    ? `مرحباً! هذا بوت ${plan.botPurpose}`
    : `Welcome! This bot is for ${plan.botPurpose}`;

  const fallback = {
    id: 'fallback',
    message: language === 'ar' ? 'عذراً، لم أفهم الطلب.' : 'Sorry, I did not understand.'
  };

  const blueprint: Blueprint = {
    language,
    welcome,
    menu,
    fallback
  };

  return blueprintSchema.parse(blueprint);
};
