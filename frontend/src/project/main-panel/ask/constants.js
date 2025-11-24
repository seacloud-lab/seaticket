export const STORAGE_CHAT_HISTORY_RECORDS_COUNT = 20;

export const CHAT_MESSAGE_TYPE = {
  GROUP: 'group',
  AI_REPLY: 'ai_reply',
  TIP: 'tip',
  ERROR: 'error',
  TEXT: 'text',
  FILE: 'file',
  PDF: 'pdf',
  IMAGE: 'image',
  SOURCES: 'sources',
  THOUGHT_PROCESS: 'thought_process',
};

export const CHAT_MESSAGE_FILE_TYPES = [
  CHAT_MESSAGE_TYPE.FILE,
  CHAT_MESSAGE_TYPE.PDF,
  CHAT_MESSAGE_TYPE.IMAGE,
];

export const ASK_PAGE_SLUG_ID = {
  NEW: 'new',
};

export const AI_RESOLVE_TYPE = {
  AGENT: 'agent',
  ASK: 'ask',
};
