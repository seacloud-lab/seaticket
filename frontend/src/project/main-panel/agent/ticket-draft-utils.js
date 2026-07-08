import { TICKET_STATE } from '@/project/main-panel/tickets/constants';

const DEFAULT_TICKET_DRAFT = {
  title: '',
  content: '',
  assignees: [],
  participants: [],
  type: '',
  type_name: '',
  tags: [],
  priority: 0,
  state: TICKET_STATE.OPEN,
  state_name: 'open',
  substate: '',
  substate_name: '',
  due_date: '',
};

const normalizeArray = (value) => Array.isArray(value) ? value : [];

const normalizePriority = (value) => {
  const priority = Number.parseInt(value, 10);
  if (Number.isNaN(priority)) return 0;
  return Math.max(0, priority);
};

const normalizeStateId = (state, stateName) => {
  const normalizedState = String(state || '').trim();
  if (normalizedState === TICKET_STATE.CLOSED || normalizedState.toLowerCase() === 'closed') {
    return TICKET_STATE.CLOSED;
  }
  const normalizedStateName = String(stateName || '').trim().toLowerCase();
  if (normalizedStateName === 'closed') {
    return TICKET_STATE.CLOSED;
  }
  return TICKET_STATE.OPEN;
};

const normalizeStateName = (state, stateName) => {
  const normalizedState = normalizeStateId(state, stateName);
  return normalizedState === TICKET_STATE.CLOSED ? 'closed' : 'open';
};

export const normalizeTicketDraft = (draft = {}) => {
  const title = String(draft.title || '').trim();
  const content = String(draft.content || '').trim();
  const state = normalizeStateId(draft.state, draft.state_name);
  return {
    ...DEFAULT_TICKET_DRAFT,
    ...draft,
    title,
    content,
    assignees: normalizeArray(draft.assignees),
    participants: normalizeArray(draft.participants),
    tags: normalizeArray(draft.tags),
    priority: normalizePriority(draft.priority),
    state,
    state_name: normalizeStateName(draft.state, draft.state_name),
    substate: String(draft.substate || '').trim(),
    substate_name: String(draft.substate_name || '').trim(),
    type: String(draft.type || '').trim(),
    type_name: String(draft.type_name || '').trim(),
    due_date: String(draft.due_date || '').trim(),
  };
};

export const parseTicketSuggestionContent = (suggestionContent) => {
  if (typeof suggestionContent !== 'string') return null;
  const normalized = suggestionContent.trim();
  if (!normalized) return null;

  try {
    const parsed = JSON.parse(normalized);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return normalizeTicketDraft(parsed);
    }
  } catch {
    return {
      ...DEFAULT_TICKET_DRAFT,
      content: normalized,
    };
  }

  return {
    ...DEFAULT_TICKET_DRAFT,
    content: normalized,
  };
};

export const formatTicketSuggestionPreview = (suggestionContent) => {
  const draft = parseTicketSuggestionContent(suggestionContent);
  if (!draft) return '';
  const title = (draft.title || '').trim();
  const content = (draft.content || '').trim();
  if (title && content) return `${title}\n\n${content}`;
  return title || content;
};

export const stringifyTicketSuggestionContent = (draft = {}) => {
  const normalizedDraft = normalizeTicketDraft(draft);
  return JSON.stringify(normalizedDraft);
};
