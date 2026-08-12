import { ACTION_TYPE, ACTION_STATUS, RUN_STATUS } from './constants';
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

export const getAgentResource = (target) => {
  if (!target) return {};
  const { source_type, source_id, source_title } = target;
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
  const isAllCompleted = runs.every(run => run.status === RUN_STATUS.COMPLETED);
  if (!isAllCompleted) return '';

  let status = [];

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const actions = run.actions || [];
    const hasPending = actions.some(
      a => a.status === ACTION_STATUS.PENDING || a.status === ACTION_STATUS.EXECUTING,
    );
    const hasFailed = actions.some(a => a.status === ACTION_STATUS.FAILED);
    const hasSuggestion = actions.some(a => a.type === ACTION_TYPE.SUGGESTION);

    if (hasPending || hasFailed) {
      status = [];
      break;
    }

    if (hasSuggestion) {
      if (!status.includes('done')) status.push('done');
    } else {
      if (!status.includes('no_action_needed')) status.push('no_action_needed');
    }
  }
  if (status.length === 0) return '';
  if (status.every(item => item === 'done')) return 'done';
  if (status.every(item => item === 'no_action_needed')) return 'no_action_needed';
  if (status.every(item => ['done', 'no_action_needed'].includes(item))) return 'done';
  return '';
};
