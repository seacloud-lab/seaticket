import { gettext } from '../../utils/constants';
import { NODE_ACTION_TYPE, DEFAULT_NODE_ACTION_TYPE_MAP } from '../constants';

export const getActionName = (action) => {
  switch (action.type) {
    case NODE_ACTION_TYPE.NOTIFY: {
      return gettext('Send a notification to');
    }
    case NODE_ACTION_TYPE.SEND_EMAIL: {
      return gettext('Send email');
    }
    case NODE_ACTION_TYPE.SEND_WECHAT: {
      return '发送企业微信';
    }
    case NODE_ACTION_TYPE.SEND_DINGTALK: {
      return '发送钉钉消息';
    }
    case NODE_ACTION_TYPE.ADD_RECORD: {
      return gettext('Add new record');
    }
    case NODE_ACTION_TYPE.UPDATE_RECORD: {
      return gettext('Set record to');
    }
    case NODE_ACTION_TYPE.LOCK_RECORD: {
      return gettext('Lock record');
    }
    case NODE_ACTION_TYPE.LINK_RECORDS: {
      return gettext('Add links');
    }
    case NODE_ACTION_TYPE.RUN_PYTHON_SCRIPT: {
      return gettext('Run Python script');
    }
    case NODE_ACTION_TYPE.ADD_OTHER_TABLE_RECORD: {
      return gettext('Add new record to other table');
    }
    default:
      return action.type;
  }
};

const generatorBase64Code = (keyLength = 4) => {
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < keyLength; i++) {
    key += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return key;
};

const generatorActionId = (actions = []) => {
  const actionIds = actions.map(action => action._id);
  let action_id = '';
  let isUnique = false;
  while (!isUnique) {
    action_id = generatorBase64Code();
    isUnique = !actionIds.includes(action_id);
    if (isUnique) {
      break;
    }
  }
  return action_id;
};

export const generatorActionByType = (actions = [], actionType) => {
  const defaultAction = DEFAULT_NODE_ACTION_TYPE_MAP[actionType];
  const id = generatorActionId(actions);
  return { ...defaultAction, _id: id };
};
