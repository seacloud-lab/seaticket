import { CellType } from 'dtable-utils';
import { gettext } from '../../utils/constants';

export const NODE_ACTION_TYPE = {
  NOTIFY: 'notify',
  SEND_EMAIL: 'send_email',
  SEND_WECHAT: 'send_wechat',
  SEND_DINGTALK: 'send_dingtalk',
  UPDATE_RECORD: 'update_record',
  ADD_RECORD: 'add_record',
  LINK_RECORDS: 'link_records',
  LOCK_RECORD: 'lock_record',
  RUN_PYTHON_SCRIPT: 'run_python_script',
  ADD_OTHER_TABLE_RECORD: 'add_record_to_other_table'
};

export const DEFAULT_NODE_ACTION_TYPE_MAP = {
  [NODE_ACTION_TYPE.NOTIFY]: {
    type: NODE_ACTION_TYPE.NOTIFY,
    users: [],
    default_msg: '',
    _id: ''
  },
  [NODE_ACTION_TYPE.SEND_EMAIL]: {
    type: NODE_ACTION_TYPE.SEND_EMAIL,
    default_msg: '',
    account_id: '',
    subject: '',
    send_to: '',
    copy_to: '',
    _id: '',
  },
  [NODE_ACTION_TYPE.SEND_WECHAT]: {
    type: NODE_ACTION_TYPE.SEND_WECHAT,
    default_msg: '',
    account_id: '',
    msg_type: 'text',
    _id: ''
  },
  [NODE_ACTION_TYPE.SEND_DINGTALK]: {
    type: NODE_ACTION_TYPE.SEND_DINGTALK,
    default_msg: '',
    default_title: '',
    account_id: '',
    msg_type: 'text',
    _id: ''
  },
  [NODE_ACTION_TYPE.UPDATE_RECORD]: {
    type: NODE_ACTION_TYPE.UPDATE_RECORD,
    updates: {},
    _id: ''
  },
  [NODE_ACTION_TYPE.ADD_RECORD]: {
    type: NODE_ACTION_TYPE.ADD_RECORD,
    row: {},
    _id: ''
  },
  [NODE_ACTION_TYPE.LINK_RECORDS]: {
    type: NODE_ACTION_TYPE.LINK_RECORDS,
    column_key: '',
    match_conditions: [],
    link_id: '',
    linked_table_id: '',
    _id: ''
  },
  [NODE_ACTION_TYPE.LOCK_RECORD]: {
    type: NODE_ACTION_TYPE.LOCK_RECORD,
    is_locked: true,
    _id: ''
  },
  [NODE_ACTION_TYPE.RUN_PYTHON_SCRIPT]: {
    type: NODE_ACTION_TYPE.RUN_PYTHON_SCRIPT,
    script_name: '',
    _id: '',
  },
  [NODE_ACTION_TYPE.ADD_OTHER_TABLE_RECORD]: {
    type: NODE_ACTION_TYPE.ADD_OTHER_TABLE_RECORD,
    dst_table_id: '',
    row: {},
    _id: '',
  }
};

export const NODE_ACTION_SUPPORT_UPDATE_COLUMN_TYPES = [
  CellType.TEXT,
  CellType.SINGLE_SELECT,
  CellType.MULTIPLE_SELECT,
  CellType.NUMBER,
  CellType.DATE,
  CellType.COLLABORATOR,
  CellType.EMAIL,
  CellType.URL,
  CellType.DURATION,
  CellType.RATE,
  CellType.CHECKBOX,
];

export const NODE_ACTION_SUPPORT_LINK_RECORD_COLUMN_TYPES = [
  CellType.TEXT,
  CellType.NUMBER,
  CellType.CHECKBOX,
  CellType.DATE,
  CellType.CTIME,
  CellType.MTIME,
  CellType.SINGLE_SELECT,
  CellType.MULTIPLE_SELECT,
  CellType.COLLABORATOR,
  CellType.CREATOR,
  CellType.GEOLOCATION,
  CellType.FORMULA,
  CellType.LINK_FORMULA,
  CellType.LINK,
  CellType.LAST_MODIFIER,
  CellType.AUTO_NUMBER,
  CellType.EMAIL,
  CellType.URL,
  CellType.IMAGE,
  CellType.FILE,
  CellType.DURATION,
  CellType.RATE,
];

export const NODE_ACTION_TIME_OPTION_TYPE = {
  SPECIFIC_DATE: 'specific_date',
  CURRENT_DAY: 'current_day',
  BEFORE_DAYS: 'before_days',
  AFTER_DAYS: 'after_days',
};

export const NODE_ACTION_TIME_OPTIONS = [
  { key: 'specific_date', name: gettext('Specific date') },
  { key: 'current_day', name: gettext('The day running the task') },
  { key: 'before_days', name: gettext('X days before running the task') },
  { key: 'after_days', name: gettext('X days after running the task') },
];
