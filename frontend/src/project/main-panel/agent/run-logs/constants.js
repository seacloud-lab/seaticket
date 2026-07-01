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

const ACTION_TYPE = {
  THOUGHT: 'thought',
  EVENT: 'event',
  ANALYSIS: 'analysis',
  TOOL_CALL: 'tool_call',
  SUGGESTION: 'suggestion',
  SUMMARY: 'summary',
  ERROR: 'error',
};

const ACTION_ICON_MAPPER = {
  [ACTION_TYPE.EVENT]: 'eye',
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

export { ACTION_STATUS, ACTION_TYPE, SUGGESTION_TOOL_NAME_MAP, ACTION_ICON_MAPPER, RUN_STATUS };
