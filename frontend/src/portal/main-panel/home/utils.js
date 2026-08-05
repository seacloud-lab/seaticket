import slugid from 'slugid';
import { DEFAULT_PROJECT_ICON, gettext } from '@/constants';

export const CARD_LAYOUT_OPTIONS = [2, 3, 4, 5, 6];

export const DEFAULT_NEW_CARD = {
  icon: DEFAULT_PROJECT_ICON,
  title: gettext('New card'),
  description: gettext('Enter card description'),
  subtitle: '',
  note: '',
  link: '',
};

export const getSafeCardLink = (link) => {
  if (typeof link !== 'string' || !link.trim()) return null;

  try {
    const url = new URL(link.trim(), window.location.origin);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.href;
  } catch (error) {
    return null;
  }
};

const DEFAULT_CARDS = [
  {
    icon: 'haiwen-users-three-fill',
    title: 'Team Collaboration',
    description: 'Work together with all your team members to solve issues faster and more effectively.',
  },
  {
    icon: 'haiwen-robot-fill',
    title: 'AI Agent Assistant',
    description: 'Let AI analyze and resolve issues automatically, providing intelligent suggestions and solutions.',
  },
  {
    icon: 'haiwen-list-checks-fill',
    title: 'Smart Ticket Recording',
    description: 'AI automatically creates structured tickets from forum threads and emails, saving you hours of manual work.',
  },
];

const DEFAULT_HOME_PAGE_STYLE = {
  'portal_home_hero_section': {
    title_size: 48,
    title_text: gettext('Hey 👋, how can we help?'),
    description_text: gettext('Chat with AI'),
    theme_type: 'color',
    background_color: '#f8f1e3',
    theme_background_image_URL: '',
  },
  'portal_home_cards_section': {
    card_layout: 3,
    cards: DEFAULT_CARDS.map(card => ({
      ...card,
      id: slugid.nice(4),
      link: '',
    })),
  },
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

  const heroSection = isPlainObject(parsedStyle['portal_home_hero_section'])
    ? parsedStyle['portal_home_hero_section']
    : {};
  const cardsSection = isPlainObject(parsedStyle['portal_home_cards_section'])
    ? parsedStyle['portal_home_cards_section']
    : {};
  const defaultHeroSection = DEFAULT_HOME_PAGE_STYLE['portal_home_hero_section'];
  const defaultCardsSection = DEFAULT_HOME_PAGE_STYLE['portal_home_cards_section'];
  const mergedHeroSection = {
    ...defaultHeroSection,
    ...heroSection,
    title_size: heroSection.title_size ?? parsedStyle.title_size ?? defaultHeroSection.title_size,
    title_text: heroSection.title_text ?? parsedStyle.title_text ?? defaultHeroSection.title_text,
    description_text: heroSection.description_text ?? parsedStyle.description_text ?? defaultHeroSection.description_text,
    theme_type: heroSection.theme_type ?? parsedStyle.theme_type ?? defaultHeroSection.theme_type,
    background_color: heroSection.background_color ?? parsedStyle.background_color ?? defaultHeroSection.background_color,
    theme_background_image_URL: heroSection.theme_background_image_URL ?? parsedStyle.theme_background_image_URL ?? defaultHeroSection.theme_background_image_URL,
  };
  const mergedCardsSection = {
    ...defaultCardsSection,
    ...cardsSection,
    card_layout: cardsSection.card_layout ?? parsedStyle.card_layout ?? defaultCardsSection.card_layout,
    cards: cardsSection.cards ?? parsedStyle.cards ?? defaultCardsSection.cards,
  };

  return {
    'portal_home_hero_section': mergedHeroSection,
    'portal_home_cards_section': {
      ...mergedCardsSection,
      card_layout: [2, 3, 4, 5, 6].includes(Number(mergedCardsSection.card_layout))
        ? Number(mergedCardsSection.card_layout)
        : defaultCardsSection.card_layout,
      cards: Array.isArray(mergedCardsSection.cards)
        ? mergedCardsSection.cards.filter(Boolean)
        : defaultCardsSection.cards,
    },
  };
};
