import { gettext } from '@/constants';

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
  ATTACHMENTS: 'attachments',
};

export const CHAT_MESSAGE_FILE_TYPES = [
  CHAT_MESSAGE_TYPE.FILE,
  CHAT_MESSAGE_TYPE.PDF,
  CHAT_MESSAGE_TYPE.IMAGE,
];

export const ASK_PAGE_SLUG_ID = {
  NEW: 'new',
};

export const SESSION_TAB_TYPE = {
  MINE: 'mine',
  TEAM: 'team'
};

export const THOUGHT_PROCESS_TYPE = {
  TASK_STEP: {
    name: gettext('Task step'),
    key: 'task_step',
    icon: 'task-step',
    isPrimaryContainer: true,
  },
  CONTEXT: {
    name: gettext('Context'),
    key: 'context',
    icon: 'context',
    isPrimaryContainer: true,
  },
  ACTION_STEPS: {
    name: gettext('Action steps'),
    key: 'action_steps',
    icon: 'action-steps',
    isPrimaryContainer: true,
  },
  ANSWER_GENERATION: {
    name: gettext('Answer generation'),
    key: 'answer_generation',
    icon: 'answer-generation',
    isPrimaryContainer: true,
  },
  STATISTICS: {
    name: gettext('Statistics'),
    key: 'statistics',
    icon: 'statistics',
    isPrimaryContainer: true,
  },
};
