export const LOG_TYPE = {
  PRIORITY_CHANGED: 'priority_changed',
  TITLE_CHANGED: 'title_changed',
  STATE_CHANGED: 'state_changed',
  SUBSTATE_CHANGED: 'substate_changed',
  STATE_SUBSTATE_CHANGED: 'state_substate_changed',
  TYPE_CHANGED: 'type_changed',
  CUSTOMER_CHANGED: 'customer_changed',

  TAGS_ADDED: 'tags_added',
  TAGS_REMOVED: 'tags_removed',
  TAGS_CHANGED: 'tags_changed',

  ASSIGNEES_ADDED: 'assignees_added',
  ASSIGNEES_REMOVED: 'assignees_removed',
  ASSIGNEES_CHANGED: 'assignees_changed',

  // general_task
  GENERAL_TASK_ADDED: 'general_task_added',
  GENERAL_TASK_UPDATED: 'general_task_updated',

  // jira
  JIRA_ISSUE_ADDED: 'jira_issue_added',

  // linear
  LINEAR_ISSUE_ADDED: 'linear_issue_added',

  // GitHub
  GITHUB_ISSUE_UPDATED: 'github_issue_updated',
  GITHUB_ISSUE_CLOSED: 'github_issue_closed',
  GITHUB_ISSUE_REOPENED: 'github_issue_reopened',
  GITHUB_ISSUE_COMMENT_ADDED: 'github_issue_comment_added',

  // discourse
  DISCOURSE_TOPIC_UPDATED: 'discourse_topic_updated',
  DISCOURSE_TOPIC_COMMENT_ADDED: 'discourse_topic_comment_added',

  // discord
  DISCORD_THREAD_UPDATED: 'discord_thread_updated',
  DISCORD_THREAD_MESSAGE_ADDED: 'discord_thread_message_added',

  // email
  EMAIL_MESSAGE_ADDED: 'email_message_added',
};

export const LOG_ICONS = {
  [LOG_TYPE.PRIORITY_CHANGED]: 'flag-stroked',

  [LOG_TYPE.TITLE_CHANGED]: 'rename',

  [LOG_TYPE.STATE_CHANGED]: 'dot-circle-stroked',
  [LOG_TYPE.SUBSTATE_CHANGED]: 'dot-circle-stroked',
  [LOG_TYPE.STATE_SUBSTATE_CHANGED]: 'dot-circle-stroked',

  [LOG_TYPE.TYPE_CHANGED]: 'type-stroked',
  [LOG_TYPE.CUSTOMER_CHANGED]: 'single-select',

  [LOG_TYPE.TAGS_ADDED]: 'tag-stroked',
  [LOG_TYPE.TAGS_REMOVED]: 'tag-stroked',
  [LOG_TYPE.TAGS_CHANGED]: 'tag-stroked',

  [LOG_TYPE.ASSIGNEES_ADDED]: 'user-stroked',
  [LOG_TYPE.ASSIGNEES_REMOVED]: 'user-stroked',
  [LOG_TYPE.ASSIGNEES_CHANGED]: 'user-stroked',

  [LOG_TYPE.GENERAL_TASK_ADDED]: 'task-filled',
  [LOG_TYPE.GENERAL_TASK_UPDATED]: 'task-filled',
  [LOG_TYPE.JIRA_ISSUE_ADDED]: 'task-filled',
  [LOG_TYPE.LINEAR_ISSUE_ADDED]: 'task-filled',

  [LOG_TYPE.GITHUB_ISSUE_UPDATED]: 'github-filled',
  [LOG_TYPE.GITHUB_ISSUE_CLOSED]: 'github-filled',
  [LOG_TYPE.GITHUB_ISSUE_REOPENED]: 'github-filled',
  [LOG_TYPE.GITHUB_ISSUE_COMMENT_ADDED]: 'github-filled',

  [LOG_TYPE.DISCOURSE_TOPIC_UPDATED]: 'discourse-filled',
  [LOG_TYPE.DISCOURSE_TOPIC_COMMENT_ADDED]: 'discourse-filled',

  [LOG_TYPE.DISCORD_THREAD_UPDATED]: 'discord-filled',
  [LOG_TYPE.DISCORD_THREAD_MESSAGE_ADDED]: 'discord-filled',

  [LOG_TYPE.EMAIL_MESSAGE_ADDED]: 'email-filled',
};

export const LINKED_ACTIVITY_TYPES = [
  LOG_TYPE.GENERAL_TASK_ADDED,
  LOG_TYPE.GENERAL_TASK_UPDATED,

  LOG_TYPE.JIRA_ISSUE_ADDED,

  LOG_TYPE.LINEAR_ISSUE_ADDED,

  LOG_TYPE.GITHUB_ISSUE_UPDATED,
  LOG_TYPE.GITHUB_ISSUE_CLOSED,
  LOG_TYPE.GITHUB_ISSUE_REOPENED,
  LOG_TYPE.GITHUB_ISSUE_COMMENT_ADDED,

  LOG_TYPE.DISCOURSE_TOPIC_UPDATED,
  LOG_TYPE.DISCOURSE_TOPIC_COMMENT_ADDED,

  LOG_TYPE.DISCORD_THREAD_UPDATED,
  LOG_TYPE.DISCORD_THREAD_MESSAGE_ADDED,

  LOG_TYPE.EMAIL_MESSAGE_ADDED,
];
