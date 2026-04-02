const ACTION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXECUTED: 'executed',
};

const ACTION_TYPE = {
  ANALYSIS: 'analysis',
  TOOL_CALL: 'tool_call',
  SUGGESTION: 'suggestion',
  SUMMARY: 'summary',
  ERROR: 'error',
};

const ACTION_ICON_MAPPER = {
  [ACTION_TYPE.ANALYSIS]: 'analysis',
  [ACTION_TYPE.TOOL_CALL]: 'tool-call',
  [ACTION_TYPE.SUGGESTION]: 'suggestion',
  [ACTION_TYPE.ERROR]: 'close'
};

// Tool names that carry a user-editable content payload
const SUGGESTION_TOOL_NAME_MAP = {
  'suggest_notify_assignee': true,
  'suggest_add_comment': true,
  'suggest_resolution': true,
  'suggest_create_ticket': true,
  'suggest_modify_type': true,
};

export { ACTION_STATUS, ACTION_TYPE, SUGGESTION_TOOL_NAME_MAP, ACTION_ICON_MAPPER };
