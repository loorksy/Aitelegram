import { sendMessage } from './telegram';

export type FlowNodeType = 'MENU' | 'MESSAGE' | 'OWNER_MENU';

export interface BlueprintMenuItem {
  title: string;
  action: string;
  mediaId?: string;
  nodeId?: string;
}

export interface LinkButton {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
  login_url?: { url: string };
}

export const handleNavigation = (action: 'home' | 'back', stack: string[]) => {
  if (action === 'home') {
    return [];
  }
  if (stack.length > 0) {
    const updated = [...stack];
    updated.pop();
    return updated;
  }
  return [];
};

export interface Blueprint {
  name: string;
  description: string;
  menu: BlueprintMenuItem[];
  skills?: string[];
  triggers?: Array<{ type: string; action: string }>;
  config?: Record<string, unknown>;
}

const chunkButtons = <T>(buttons: T[]) => {
  const rows: T[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  return rows;
};

export const buildMenuKeyboard = (
  menuItems: BlueprintMenuItem[],
  includeOwner = false,
  linkButtons?: LinkButton[]
) => {
  const buttons: LinkButton[] = menuItems.map((item, index) => ({
    text: item.title,
    callback_data: `menu:${index}`
  }));

  const rows: LinkButton[][] = chunkButtons(buttons);

  if (linkButtons && linkButtons.length > 0) {
    rows.push(...chunkButtons(linkButtons));
  }

  rows.push([
    { text: '🏠 الرئيسية', callback_data: 'nav:home' },
    { text: '◀️ رجوع', callback_data: 'nav:back' }
  ]);

  if (includeOwner) {
    rows.push([{ text: 'لوحة التحكم', callback_data: 'owner:panel' }]);
  }

  return { inline_keyboard: rows };
};

export const sendMenu = async (
  token: string,
  chatId: number,
  welcomeText: string,
  menuItems: BlueprintMenuItem[],
  includeOwner = false,
  linkButtons?: LinkButton[]
) => {
  await sendMessage(token, chatId, welcomeText, {
    reply_markup: buildMenuKeyboard(menuItems, includeOwner, linkButtons)
  });
};

export const sendMenuItemMessage = async (
  token: string,
  chatId: number,
  item: BlueprintMenuItem
) => {
  await sendMessage(token, chatId, item.action);
};
