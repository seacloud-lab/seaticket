import { gettext } from '../../utils/constants';

export const NODE_TYPE = {
  INIT: 'init',
  NORMAL: 'normal',
  CANCELED: 'canceled',
  COMPLETED: 'completed'
};

export const NODE_TYPE_ID_MAP = {
  [NODE_TYPE.INIT]: 'init',
  [NODE_TYPE.COMPLETED]: '1'
};

export const NODE_PARTICIPANTS_TYPE = {
  STATIC: 'static',
  DYNAMIC: 'dynamic'
};

export const NORMAL_NODE_TEMPLATE = {
  '_id': '',
  'type': NODE_TYPE.NORMAL,
  'name': gettext('Node'),
  'state': '',
  'participants': [],
  'participants_type': 'static',
  'node_participants_column_key': '',
  'next_node_id': '',
  'conditional_next_nodes': [],
  'other_node_ids': [],
  'node_form': {
    'readonly_columns': [],
    'readwrite_columns': [],
  },
};

export const INIT_NODE_TEMPLATE = {
  '_id': '',
  'type': NODE_TYPE.INIT,
  'name': gettext('Start'),
  'state': '',
  'participants': [],
  'next_node_id': '',
  'conditional_next_nodes': [],
  'other_node_ids': [],
  'node_form': {
    'readwrite_columns': [],
  },
};

export const COMPLETED_NODE_TEMPLATE = {
  '_id': '',
  'type': NODE_TYPE.COMPLETED,
  'name': gettext('Finished'),
  'state': '',
  'node_form': {
    'readonly_columns': []
  }
};

export const CANCELED_NODE_TEMPLATE = {
  '_id': 'canceled',
  'type': NODE_TYPE.CANCELED,
  'name': gettext('Canceled')
};

export const INIT_NODES = [
  {
    '_id': 'init',
    'type': NODE_TYPE.INIT,
    'name': gettext('Start'),
    'state': '',
    'participants': [],
    'next_node_id': '1',
    'conditional_next_nodes': [],
    'other_node_ids': [],
    'node_form': {
      'readwrite_columns': []
    },
  }, {
    '_id': '1',
    'type': NODE_TYPE.COMPLETED,
    'name': gettext('Finished'),
    'state': '',
    'is_send_finish_task_message': true,
    'finish_task_message': '',
    'node_form': {
      'readonly_columns': []
    },
  }
];

export const NODE_WIDTH = 250;
export const HALF_NODE_WIDTH = 125; // 125 = 250 / 2
export const NODE_WIDTH_GAP = 50;
export const HALF_NODE_WIDTH_GAP = 25; // 25 = 50 / 2
export const NODE_HEIGHT = 38;
export const HALF_NODE_HEIGHT = 19; // 19 = 38 / 2
export const NODE_HEIGHT_GAP = 100;
export const HALF_NODE_HEIGHT_GAP = 50; // 50 = 100 /2

export const LINE_Z_INDEX = 1;
export const LINE_ACTIVE_Z_INDEX = 2;
export const LINE_ADD_BUTTON_Z_INDEX = 3;
export const LINE_ACTIVE_ADD_BUTTON_Z_INDEX = 4;
export const NODE_Z_INDEX = 5;

export const NODE_DIRECTION = {
  TB: 'TB',
  LR: 'LR',
};

export const ARROW_DIRECTION = {
  TOP: 'top',
  RIGHT: 'right',
  BOTTOM: 'bottom',
  LEFT: 'left'
};
