import slugid from 'slugid';
import { gettext } from '@/constants';

const CARDS = [
  {
    icon: '👥',
    title: 'Team Collaboration',
    description: 'Work together with all your team members to solve issues faster and more effectively',
  },
  {
    icon: '🤖',
    title: 'AI Agent Assistant',
    description: 'Let AI analyze and resolve issues automatically, providing intelligent suggestions and solutions.',
  },
  {
    icon: '🗂️',
    title: 'Smart Ticket Recording',
    description: 'AI automatically creates structured tickets from forum threads and emails, saving you hours of manual work.',
  },
  {
    icon: '💬',
    title: 'Chat',
    description: 'Work together with all your team members to solve issues faster and more effectively',
  },
  {
    icon: '🔄',
    title: 'Sync Multiple Sources',
    description: 'Let AI analyze and resolve issues automatically, providing intelligent suggestions and solutions.',
  },
  {
    icon: '🧩',
    title: 'Data linking',
    description: 'AI automatically creates structured tickets from forum threads and emails, saving you hours of manual work.',
  },
];

const CARDS_WITH_ID = CARDS.map(card => ({
  ...card,
  id: slugid.nice(4),
  link: '',
}));

const DEFAULT_HOME_PAGE_STYLE = {
  titleText: gettext('Hey 👋, how can we help?'),
  descriptionText: gettext('Chat with AI'),
  titleSize: 56,
  backgroundColor: '#f8f1e3',
  themeType: 'color',
  themeBackgroundImageURL: '',
  cards: CARDS_WITH_ID,
};

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

export const normalizeHomePageStyle = (style) => {
  let parsedStyle = style;

  if (typeof parsedStyle === 'string') {
    try {
      parsedStyle = JSON.parse(parsedStyle);
    } catch (e) {
      parsedStyle = null;
    }
  }

  if (!isPlainObject(parsedStyle)) {
    return DEFAULT_HOME_PAGE_STYLE;
  }

  return {
    ...DEFAULT_HOME_PAGE_STYLE,
    ...parsedStyle,
    cardLayout: [2, 3, 4, 5, 6].includes(Number(parsedStyle.cardLayout)) ? Number(parsedStyle.cardLayout) : DEFAULT_HOME_PAGE_STYLE.cardLayout,
    cards: Array.isArray(parsedStyle.cards) ? parsedStyle.cards : DEFAULT_HOME_PAGE_STYLE.cards,
  };
};
