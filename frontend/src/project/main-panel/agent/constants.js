import { gettext } from '@/constants';

const RUN_STATUS = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const ACTION_STATUS = {
  PENDING: 'pending',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXECUTED: 'executed',
  FAILED: 'failed',
};

const SUGGESTIONS_STATUS = {
  NONE: 'none',
  PENDING: 'pending',
  RESOLVED: 'resolved',
  FAILED: 'failed',
};

const ACTION_TYPE = {
  THOUGHT: 'thought',
  EVENT: 'event', // for compatible
  PRELUDE: 'prelude',
  ANALYSIS: 'analysis',
  HANDLING: 'handling',
  TOOL_CALL: 'tool_call',
  SUGGESTION: 'suggestion',
  SUMMARY: 'summary',
  ERROR: 'error',
};

const ACTION_ICON_MAPPER = {
  [ACTION_TYPE.EVENT]: 'eye',
  [ACTION_TYPE.PRELUDE]: 'eye',
  [ACTION_TYPE.ANALYSIS]: 'analysis',
  [ACTION_TYPE.SUGGESTION]: 'suggestion',
  [ACTION_TYPE.ERROR]: 'close'
};

// Tool names that carry a user-editable content payload
const SUGGESTION_TOOL_NAME_MAP = {
  'suggest_notify_assignee': true,
  'suggest_reply': true,
  'suggest_create_ticket': true,
  'suggest_modify_type': true,
  'suggest_assign_labels': true,
};

const RUN_EVENT = {
  // GitHub
  GITHUB_ISSUE_ADDED: 'github_issue_added',
  GITHUB_ISSUE_COMMENT_ADDED: 'github_issue_comment_added',

  // discourse
  DISCOURSE_TOPIC_ADDED: 'discourse_topic_added',
  DISCOURSE_TOPIC_COMMENT_ADDED: 'discourse_topic_comment_added',

  // email
  EMAIL_THREAD_ADDED: 'email_thread_added',
  EMAIL_MESSAGE_ADDED: 'email_message_added',

  // ticket
  TICKET_DUE_SOON: 'ticket_due_soon',
  TICKET_OVER_DUE: 'ticket_over_due',
  TICKET_TASK_FINISHED: 'general_task_updated',
};

const RUN_EVENT_NAME = {
  [RUN_EVENT.GITHUB_ISSUE_ADDED]: gettext('New GitHub issue'),
  [RUN_EVENT.GITHUB_ISSUE_COMMENT_ADDED]: gettext('New issue comment'),
  [RUN_EVENT.DISCOURSE_TOPIC_ADDED]: gettext('New forum topic'),
  [RUN_EVENT.DISCOURSE_TOPIC_COMMENT_ADDED]: gettext('New topic comment'),
  [RUN_EVENT.EMAIL_THREAD_ADDED]: gettext('New email thread'),
  [RUN_EVENT.EMAIL_MESSAGE_ADDED]: gettext('New email message'),
  [RUN_EVENT.TICKET_DUE_SOON]: gettext('Ticket due soon'),
  [RUN_EVENT.TICKET_OVER_DUE]: gettext('Ticket overdue'),
  [RUN_EVENT.TICKET_TASK_FINISHED]: gettext('Internal task finished'),
};


export {
  ACTION_STATUS, ACTION_TYPE, SUGGESTION_TOOL_NAME_MAP, ACTION_ICON_MAPPER,
  RUN_STATUS, RUN_EVENT_NAME, SUGGESTIONS_STATUS,
};
