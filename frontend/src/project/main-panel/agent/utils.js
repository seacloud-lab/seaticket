import { gettext } from '@/constants';
import { getResourceIconURL, getResourceTypeName } from '@/project/utils';
import { CONNECTION_TYPES } from '../connections/constants';
import { ACTION_TYPE, RUN_EVENT, RUN_STATUS, SUGGESTIONS_STATUS } from './constants';

export const getTriggerInfoFromRun = (run) => {
  const eventType = run?.event?.type;
  const newValue = run?.event?.new_value;
  switch (eventType) {
    case RUN_EVENT.EMAIL_THREAD_ADDED:
    case RUN_EVENT.GITHUB_ISSUE_ADDED:
    case RUN_EVENT.DISCOURSE_TOPIC_ADDED:
    case RUN_EVENT.DISCORD_THREAD_ADDED: {
      return { key: 'index', value: 0 };
    }
    case RUN_EVENT.EMAIL_MESSAGE_ADDED:
    case RUN_EVENT.DISCORD_THREAD_MESSAGE_ADDED: {
      return { key: 'value', value: newValue?.message_id };
    }
    case RUN_EVENT.GITHUB_ISSUE_COMMENT_ADDED: {
      return { key: 'value', value: newValue?.comment_id };
    }
    case RUN_EVENT.DISCOURSE_TOPIC_COMMENT_ADDED: {
      return { key: 'value', value: newValue?.post_number };
    }
    default: {
      return null;
    }
  }
};

export const getDisplayActions = (actions) => {
  if (!Array.isArray(actions) || actions.length === 0) return [];
  const allActions = actions.filter((action, actionIndex, arr) => {
    if (action.type !== ACTION_TYPE.THOUGHT) return true;
    const nextAction = arr[actionIndex + 1];
    return !(nextAction && nextAction.type === ACTION_TYPE.SUMMARY);
  }).filter(action => {
    if (action.type === ACTION_TYPE.SUMMARY) return false;
    if (action.type === ACTION_TYPE.HANDLING) return false;
    if (action.type === ACTION_TYPE.TOOL_CALL) return false;
    return true;
  });
  let suggestionActions = [];
  let otherActions = [];
  allActions.forEach(action => {
    if (action.type === ACTION_TYPE.SUGGESTION) {
      suggestionActions.push(action);
    } else {
      otherActions.push(action);
    }
  });
  if (suggestionActions.length === 0) return otherActions;
  return [...otherActions, {
    type: ACTION_TYPE.SUGGESTION,
    children: suggestionActions,
  }];
};

export const parseSuggestionActionResult = (result) => {
  if (!result) return { message: '' };

  if (typeof result === 'object') {
    return {
      message: result.message || result.result || JSON.stringify(result),
      ticket: result.ticket,
    };
  }

  if (typeof result !== 'string') {
    return { message: String(result) };
  }

  try {
    const parsed = JSON.parse(result);
    if (parsed && typeof parsed === 'object') {
      return {
        message: parsed.message || result,
        ticket: parsed.ticket,
      };
    }
  } catch {
    return { message: result };
  }

  return { message: result };
};

export const parseSuggestionPayload = (payload) => {
  if (!payload) return {};
  if (typeof payload === 'object') return Array.isArray(payload) ? {} : payload;
  if (typeof payload !== 'string') return {};
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const normalizeEmailAddressList = (value) => {
  if (Array.isArray(value)) {
    return value.map(item => String(item || '').trim()).filter(Boolean);
  }
  const text = String(value || '').trim();
  return text ? [text] : [];
};

export const getEmailReplyDefaultTo = (event) => {
  if (!event || typeof event !== 'object') return [];
  const type = String(event.type || '');
  if (!type.startsWith('email_')) return [];
  return extractEmailAddresses(event.new_value?.email_from);
};

export const extractEmailAddresses = (addressText) => {
  if (!addressText) return [];
  const regex = /([^<,]*?)\s*<([^@\s>,]+@[^>\s,]+)>|([^\s,;<>]+@[^\s,;<>]+)/g;
  const result = [];
  const seen = new Set();
  let match;
  while ((match = regex.exec(addressText)) !== null) {
    const name = (match[1] || '').trim();
    const address = (match[2] || match[3] || '').trim();
    if (!address || seen.has(address.toLowerCase())) continue;
    seen.add(address.toLowerCase());
    result.push(name ? `${name} <${address}>` : address);
  }
  return result;
};

export const parseEmailReplySuggestion = (suggestionContent, defaultReplyTo = []) => {
  const fallbackTo = normalizeEmailAddressList(defaultReplyTo);
  if (typeof suggestionContent === 'string') {
    const trimmed = suggestionContent.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          && ('to' in parsed || 'cc' in parsed || 'is_html' in parsed)) {
          const to = normalizeEmailAddressList(parsed.to);
          return {
            to: to.length > 0 ? to : fallbackTo,
            cc: normalizeEmailAddressList(parsed.cc),
            content: typeof parsed.content === 'string' ? parsed.content : '',
            is_html: Boolean(parsed.is_html),
          };
        }
      } catch {
        // fall through to plain text
      }
    }
  }
  return {
    to: fallbackTo,
    cc: [],
    content: typeof suggestionContent === 'string' ? suggestionContent : '',
    is_html: false,
  };
};

const EMAIL_SANITIZE_ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'hr', 'i', 'img',
  'li', 'ol', 'p', 's', 'span', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul',
]);
const EMAIL_SANITIZE_ALLOWED_ATTRS = new Set(['alt', 'href', 'src', 'style', 'title']);
const EMAIL_SANITIZE_SAFE_URL = /^(?:https?:|mailto:|data:image\/)/i;

// Sanitize by parsing then rebuilding the DOM with only whitelisted tags/attrs,
// so any unlisted vector (on* handlers, javascript: URLs, iframes, ...) is dropped.
export const sanitizeEmailHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const sanitizeNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || '');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const tag = node.tagName.toLowerCase();
    if (!EMAIL_SANITIZE_ALLOWED_TAGS.has(tag)) {
      const fragment = document.createDocumentFragment();
      Array.from(node.childNodes).forEach(child => {
        const clean = sanitizeNode(child);
        if (clean) fragment.appendChild(clean);
      });
      return fragment;
    }
    const el = document.createElement(tag);
    Array.from(node.attributes).forEach(attr => {
      const name = attr.name.toLowerCase();
      if (!EMAIL_SANITIZE_ALLOWED_ATTRS.has(name)) return;
      const value = attr.value || '';
      if (['href', 'src'].includes(name)) {
        if (!EMAIL_SANITIZE_SAFE_URL.test(value.trim())) return;
        el.setAttribute(name, value);
        if (tag === 'a') {
          el.setAttribute('rel', 'noopener noreferrer');
          el.setAttribute('target', '_blank');
        }
        return;
      }
      el.setAttribute(name, value);
    });
    Array.from(node.childNodes).forEach(child => {
      const clean = sanitizeNode(child);
      if (clean) el.appendChild(clean);
    });
    return el;
  };
  const container = document.createElement('div');
  Array.from(doc.body.childNodes).forEach(child => {
    const clean = sanitizeNode(child);
    if (clean) container.appendChild(clean);
  });
  return container.innerHTML;
};

const normalizeSuggestionLabels = (labels) => {
  if (!Array.isArray(labels)) return [];
  const seen = new Set();
  return labels
    .map(label => String(label || '').trim())
    .filter(Boolean)
    .filter(label => {
      const key = label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const getSuggestionTitle = (action) => {
  if (!action) return '';
  const payload = parseSuggestionPayload(action.suggestion_payload);
  switch (action.tool_name) {
    case 'suggest_reply':
      return gettext('Send a reply');
    case 'suggest_reply_external_targets':
      return gettext('Send a reply to the linked external record');
    case 'suggest_create_ticket':
      return gettext('Create an internal ticket from this record');
    case 'suggest_link_existing_ticket': {
      const relatedTicket = Number(payload.related_ticket);
      if (Number.isInteger(relatedTicket) && relatedTicket > 0) {
        return gettext('Link this record to an existing internal ticket #%(ticket)s')
          .replace('%(ticket)s', String(relatedTicket));
      }
      return gettext('Link this record to an existing internal ticket');
    }
    case 'suggest_modify_type': {
      const currentType = typeof payload.current_issue_type === 'string' ? payload.current_issue_type.trim() : '';
      const suggestedType = typeof payload.suggested_type === 'string' ? payload.suggested_type.trim() : '';
      if (currentType && suggestedType) {
        return gettext('Change the type from "%(current)s" to "%(suggested)s" for this GitHub issue')
          .replace('%(current)s', currentType)
          .replace('%(suggested)s', suggestedType);
      }
      if (suggestedType) {
        return gettext('Change the type to "%(suggested)s" for this GitHub issue')
          .replace('%(suggested)s', suggestedType);
      }
      return gettext('Suggest a more suitable issue type for this GitHub issue');
    }
    case 'suggest_assign_labels': {
      const labels = normalizeSuggestionLabels(payload.suggested_labels);
      if (labels.length > 0) {
        return gettext('Assign labels %(labels)s to this GitHub issue')
          .replace('%(labels)s', JSON.stringify(labels));
      }
      return gettext('Assign labels to this GitHub issue');
    }
    case 'suggest_notify_assignee':
      return gettext('Notify assignees of the ticket');
    case 'suggest_move_to_spam':
      return gettext('Move this email thread to the spam folder');
    case 'suggest_close_ticket':
      return gettext('Close this ticket');
    default:
      return '';
  }
};

const getSourceInfoFromRunOrLog = (target) => {
  if (!target) return null;
  if (target.owner_source_type === undefined && target.owner_source_id === undefined && target.owner_source_title === undefined) {
    return null;
  }
  return {
    source_type: target.owner_source_type || '',
    source_id: target.owner_source_id || '',
    source_title: target.owner_source_title || '',
  };
};

const getSourceInfoFromAction = (target) => {
  if (!target) return null;
  if (target.target_item_type === undefined && target.target_item_id === undefined && target.target_item_title === undefined) {
    return null;
  }
  return {
    source_type: target.target_item_type || '',
    source_id: target.target_item_id || '',
    source_title: target.target_item_title || '',
  };
};

const buildResourceFromSourceInfo = ({ source_type, source_id, source_title }) => {
  if (!source_id) return {};
  const icon = getResourceIconURL(source_type);
  const sourceId = String(source_id || '');
  const sourceTypeName = getResourceTypeName(source_type);
  if (CONNECTION_TYPES.find(connection => connection.type === source_type) && sourceId.indexOf('_') > -1) {
    const source_ids = sourceId.split('_');
    const connectionId = Number(source_ids[0]);
    const actualSourceId = Number(source_ids[1]);
    return {
      type: source_type,
      type_name: sourceTypeName,
      _id: actualSourceId,
      title: source_title,
      connection_id: connectionId,
      icon,
    };
  }
  return {
    type: source_type,
    type_name: sourceTypeName,
    _id: Number(source_id),
    title: source_title,
    icon,
  };
};

export const getAgentResource = (target) => {
  if (!target) return {};
  const sourceInfo = getSourceInfoFromAction(target) || getSourceInfoFromRunOrLog(target);
  if (!sourceInfo) return {};
  return buildResourceFromSourceInfo(sourceInfo);
};

export const getRunLogStatusByRuns = (runs) => {
  if (!Array.isArray(runs) || runs.length === 0) return '';
  const isAllCompleted = runs.every(run => run.status === RUN_STATUS.COMPLETED);
  if (!isAllCompleted) return '';

  const suggestionsStatuses = runs.map(run => (run.suggestions_status || '').trim());
  if (suggestionsStatuses.some(item => [SUGGESTIONS_STATUS.PENDING, SUGGESTIONS_STATUS.FAILED, ''].includes(item))) {
    return '';
  }
  return 'done';
};
