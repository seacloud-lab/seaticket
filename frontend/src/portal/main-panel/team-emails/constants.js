import React from 'react';
import { gettext } from '@/constants';
import { TICKET_STATE_OPTIONS } from '@/project/main-panel/tickets/constants';
import { CellType } from '@/sea-metadata';
import ProcessingStatusFormatter from './processing-status-formatter';

export const EMAIL_TABLE_NAME = 'portal_emails';
export const EMAIL_LOCAL_STORAGE_PREFIX = 'seaqa-portal-emails';
export const EMAIL_VIEW = { _id: 'all', name: gettext('All emails') };

export const EMAIL_COLUMN_ORDER = {
  processing_status: 1,
  title: 2,
  ticket_pk: 3,
  state: 4,
  assignees: 5,
  participants: 6,
  due_date: 7,
  modified_time: 8,
};

export const EMAIL_COLUMN_WIDTHS = {
  processing_status: 32,
  title: 320,
  ticket_pk: 120,
  state: 120,
  assignees: 200,
  due_date: 200,
  modified_time: 200,
};

export const EMAIL_COLUMNS = [
  {
    key: 'processing_status',
    name: 'processing_status',
    display_name: gettext('Processing status'),
    type: CellType.PROCESSING_STATUS,
    width: EMAIL_COLUMN_WIDTHS.processing_status,
    is_width_fixed: true,
    frozen: true,
    editable: false,
    formatter: <ProcessingStatusFormatter />,
  },
  {
    key: 'subject',
    name: 'title',
    display_name: gettext('Subject'),
    type: CellType.TEXT,
    width: 320,
    frozen: true,
    is_name_column: true,
    editable: false,
  },
  {
    key: 'ticket',
    name: 'ticket_pk',
    display_name: gettext('Ticket #'),
    type: CellType.NUMBER,
    width: 120,
    editable: false,
    data: {
      format: '#'
    }
  },
  {
    key: 'state',
    name: 'state',
    display_name: gettext('State'),
    type: CellType.SINGLE_SELECT,
    width: 120,
    editable: false,
    data: { options: TICKET_STATE_OPTIONS },
  },
  {
    key: 'assignees',
    name: 'assignees',
    display_name: gettext('Assignees'),
    type: CellType.COLLABORATOR,
    width: 200,
    editable: false,
  },
  {
    key: 'participants',
    name: 'participants',
    display_name: gettext('Participants'),
    type: CellType.COLLABORATOR,
    editable: false,
    modify_data_able: false,
    sort_able: false,
    filter_able: false,
    data: {
      is_email_user: true,
    },
  },
  {
    key: 'due_date',
    name: 'due_date',
    display_name: gettext('Due date'),
    type: CellType.DATE,
    width: 200,
    editable: false,
    data: { format: 'YYYY-MM-DD' },
  },
  {
    key: 'modified_time',
    name: 'modified_time',
    display_name: gettext('Last modified time'),
    type: CellType.MTIME,
    width: 200,
    editable: false,
  },
];

export const EMAIL_VIEWS_DATA = {
  navigation: [{ _id: EMAIL_VIEW._id, type: 'view' }],
  views: [EMAIL_VIEW],
};

export const EMAIL_VIEW_DATA = {
  ...EMAIL_VIEW,
  columns_keys: EMAIL_COLUMNS.map(column => column.key),
};
