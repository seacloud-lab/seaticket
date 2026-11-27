import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { EVENT_BUS_TYPE } from '@/project/constants';
import ConnectionRecordDetailsInDialog from '@/project/main-panel/connections/components/connection-record-details-in-dialog';
import eventBus from '@/utils/event-bus';

const mockMain = jest.fn();
const mockOthers = jest.fn();
jest.mock('@/components', () => ({}));
jest.mock('@/constants', () => ({ PERMISSION_TYPES: { READ_ONLY: 'r' } }));
jest.mock('@/models/user', () => jest.fn());
jest.mock('@/project/api', () => ({}));
jest.mock('@/project/constants', () => ({ EVENT_BUS_TYPE: { TICKET_LINKED: 'linked', RESOURCE_UPDATED: 'updated' } }));
jest.mock('@/project/hooks', () => ({ useData: () => ({}), useTags: () => ({}) }));
jest.mock('@/project/hooks/link-ticket', () => ({
  ...jest.requireActual('@/project/hooks/link-ticket'),
  useLinkTicket: () => ({ generateConnectionLinkTicketOptions: () => [] }),
}));
jest.mock('@/project/main-panel/connections/constants', () => ({
  SUPPORT_ROW_DETAILS_SETTINGS_CONNECTION_TYPES: ['github_issue'],
  CONNECTION_PREDEFINED_COLUMN_NAME: {}, CONNECTION_TYPE: {},
}));
jest.mock('@/project/main-panel/connections/hooks', () => ({ useConnections: () => ({ connections: [{ id: 1, type: 'github_issue' }] }) }));
jest.mock('@/project/main-panel/connections/utils', () => ({
  formatColumns: (_connection, columns) => columns,
  getTableName: connection => connection ? `${connection.type}_${connection.id}` : '',
}));
jest.mock('@/project/main-panel/connections/components/connection-resource-details', () => ({
  __esModule: true,
  default: props => { mockMain(props); return null; },
  ConnectionResourceOtherDetails: props => { mockOthers(props); return null; },
}));
jest.mock('@/sea-metadata/constants', () => ({ CellType: {}, EVENT_BUS_TYPE: {} }));
jest.mock('@/sea-metadata/context', () => ({}));
jest.mock('@/sea-metadata/utils/cell', () => ({}));
jest.mock('@/sea-metadata/utils/column', () => ({}));
jest.mock('@/utils/dialog', () => ({ isSmallContainer: () => false }));
jest.mock('@/utils/utils', () => ({}));

const lastProps = mock => mock.mock.calls[mock.mock.calls.length - 1][0];
const columns = [{ key: 'link', name: 'linked_ticket' }];
const resource = { type: 'github_issue', connection_id: 1, _id: '7' };

describe('Connection detail updates during loading', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  const originalResizeObserver = global.ResizeObserver;
  let root;
  let onUpdateResourceDetails;

  const render = (rowId = '7') => act(() => root.render(
    <ConnectionRecordDetailsInDialog
      projectUuid="project" resource={{ ...resource, _id: rowId }} columns={columns}
      onUpdateResourceDetails={onUpdateResourceDetails}
    />
  ));
  const notify = (rowId = '7') => act(() => eventBus.dispatch(EVENT_BUS_TYPE.TICKET_LINKED, {
    projectUuid: 'project', tableName: 'github_issue_1', rowId,
    rowUpdate: { linked_ticket: 73 }, ticket: { title: 'Linked ticket' },
  }));
  const load = (rowId = '7') => act(() => lastProps(mockMain).updateResource({
    record: { _pk: rowId, title: 'Record', linked_ticket: null }, columns, linked_ticket_title: '',
  }));

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    global.ResizeObserver = class { observe() {} disconnect() {} };
    jest.clearAllMocks();
    onUpdateResourceDetails = jest.fn();
    root = createRoot(document.createElement('div'));
    render();
  });
  afterEach(() => {
    act(() => root.unmount());
    global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
    global.ResizeObserver = originalResizeObserver;
  });

  it('merges link and menu updates into the older detail response without exposing partial details', () => {
    notify();
    act(() => eventBus.dispatch(EVENT_BUS_TYPE.RESOURCE_UPDATED, {
      projectUuid: 'project', tableName: 'github_issue_1', rowId: '7', rowUpdate: { outdated: true },
    }));
    expect(onUpdateResourceDetails).not.toHaveBeenCalled();
    expect(mockOthers).not.toHaveBeenCalled();

    load();

    expect(onUpdateResourceDetails).toHaveBeenLastCalledWith(expect.objectContaining({
      record: { _pk: '7', title: 'Record', linked_ticket: 73, outdated: true }, linked_ticket_title: 'Linked ticket', columns,
    }));
    expect(lastProps(mockOthers).linkedTicketTitle).toBe('Linked ticket');
  });

  it('discards pending updates when switching records', () => {
    notify();
    render('8');
    notify('7');
    load('8');

    expect(lastProps(mockOthers).record.linked_ticket).toBeNull();
    expect(lastProps(mockOthers).linkedTicketTitle).toBe('');
  });

  it('continues applying link results after the details have loaded', () => {
    load();
    notify();

    expect(lastProps(mockOthers).record.linked_ticket).toBe(73);
    expect(lastProps(mockOthers).linkedTicketTitle).toBe('Linked ticket');
  });
});
