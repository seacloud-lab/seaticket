import { ACTION_TYPE, RUN_STATUS, SUGGESTIONS_STATUS } from './constants';
import { CONNECTION_TYPES } from '../connections/constants';
import { getResourceIconURL, getResourceTypeName } from '@/project/utils';

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

const getResourceValue = (target, field) => {
  if (target[field] !== undefined) return target[field];
  if (target[`owner_${field}`] !== undefined) return target[`owner_${field}`];
  if (target[`target_${field}`] !== undefined) return target[`target_${field}`];
  return '';
};

export const getAgentResource = (target) => {
  if (!target) return {};
  const source_type = getResourceValue(target, 'source_type');
  const source_id = getResourceValue(target, 'source_id');
  const source_title = getResourceValue(target, 'source_title');
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

export const getRunLogStatusByRuns = (runs) => {
  if (!Array.isArray(runs) || runs.length === 0) return '';
  const isAllCompleted = runs.every(run => run.status === RUN_STATUS.COMPLETED);
  if (!isAllCompleted) return '';

  const suggestionsStatuses = runs.map(run => (run.suggestions_status || '').trim());
  if (suggestionsStatuses.some(item => [SUGGESTIONS_STATUS.PENDING, SUGGESTIONS_STATUS.FAILED, ''].includes(item))) {
    return '';
  }
  if (suggestionsStatuses.some(item => item === SUGGESTIONS_STATUS.RESOLVED)) return 'done';
  if (suggestionsStatuses.every(item => item === SUGGESTIONS_STATUS.NONE)) return 'no_action_needed';
  return '';
};
