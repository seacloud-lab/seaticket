import { gettext } from '@/constants';

const RUN_STATUS = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const LOG_STATUS = {
  PROCESSED: 'processed',
  UNPROCESSED: 'unprocessed'
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
  USER_INSTRUCTION: 'user_instruction',
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

  // portal issue
  PORTAL_ISSUE_ADDED: 'portal_issue_added',
  PORTAL_ISSUE_COMMENT_ADDED: 'portal_issue_comment_added',

  // email
  EMAIL_THREAD_ADDED: 'email_thread_added',
  EMAIL_MESSAGE_ADDED: 'email_message_added',

  // discord
  DISCORD_THREAD_ADDED: 'discord_thread_added',
  DISCORD_THREAD_MESSAGE_ADDED: 'discord_thread_message_added',

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
  [RUN_EVENT.PORTAL_ISSUE_ADDED]: gettext('New portal issue'),
  [RUN_EVENT.PORTAL_ISSUE_COMMENT_ADDED]: gettext('New portal issue comment'),
  [RUN_EVENT.EMAIL_THREAD_ADDED]: gettext('New email thread'),
  [RUN_EVENT.EMAIL_MESSAGE_ADDED]: gettext('New email message'),
  [RUN_EVENT.DISCORD_THREAD_ADDED]: gettext('New Discord thread'),
  [RUN_EVENT.DISCORD_THREAD_MESSAGE_ADDED]: gettext('New Discord message'),
  [RUN_EVENT.TICKET_DUE_SOON]: gettext('Ticket due soon'),
  [RUN_EVENT.TICKET_OVER_DUE]: gettext('Ticket overdue'),
  [RUN_EVENT.TICKET_TASK_FINISHED]: gettext('Internal task finished'),
};

const RUN_EVENT_VIEW_SOURCE_TEXT = {
  [RUN_EVENT.EMAIL_THREAD_ADDED]: gettext('View email'),
  [RUN_EVENT.EMAIL_MESSAGE_ADDED]: gettext('View email'),
  [RUN_EVENT.GITHUB_ISSUE_ADDED]: gettext('View issue'),
  [RUN_EVENT.GITHUB_ISSUE_COMMENT_ADDED]: gettext('View comment'),
  [RUN_EVENT.DISCOURSE_TOPIC_ADDED]: gettext('View topic'),
  [RUN_EVENT.DISCOURSE_TOPIC_COMMENT_ADDED]: gettext('View comment'),
  [RUN_EVENT.DISCORD_THREAD_ADDED]: gettext('View thread'),
  [RUN_EVENT.DISCORD_THREAD_MESSAGE_ADDED]: gettext('View comment'),
  [RUN_EVENT.TICKET_DUE_SOON]: gettext('View ticket'),
  [RUN_EVENT.TICKET_OVER_DUE]: gettext('View ticket'),
  [RUN_EVENT.TICKET_TASK_FINISHED]: gettext('View ticket'),
};

const DEFAULT_VIEW_SOURCE_TEXT = gettext('View source');

export {
  ACTION_STATUS, LOG_STATUS, ACTION_TYPE, SUGGESTION_TOOL_NAME_MAP, ACTION_ICON_MAPPER,
  RUN_STATUS, RUN_EVENT, RUN_EVENT_NAME, RUN_EVENT_VIEW_SOURCE_TEXT, DEFAULT_VIEW_SOURCE_TEXT, SUGGESTIONS_STATUS,
};
