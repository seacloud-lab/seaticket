import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { EVENT_BUS_TYPE } from '@/project/constants';
import { useData } from '@/project/hooks';
import { useResourceUpdate } from '@/project/hooks/resource-dialog';
import ConnectionRecordDetailsInDialog from '@/project/main-panel/connections/components/connection-record-details-in-dialog';
import eventBus from '@/utils/event-bus';

const mockMain = jest.fn();
const mockOthers = jest.fn();
jest.mock('@/components', () => ({}));
jest.mock('@/constants', () => ({ PERMISSION_TYPES: { READ_ONLY: 'r' } }));
jest.mock('@/models/user', () => jest.fn());
jest.mock('@/project/api', () => ({ connectionsAPI: { modifyGithubIssue: jest.fn(async () => ({ data: {} })) } }));
jest.mock('@/project/constants', () => ({ EVENT_BUS_TYPE: { TICKET_LINKED: 'linked', RESOURCE_UPDATED: 'updated' } }));
jest.mock('@/project/hooks', () => ({ useData: jest.fn(), useTags: () => ({}) }));
jest.mock('@/project/hooks/link-ticket', () => ({
  ...jest.requireActual('@/project/hooks/link-ticket'),
  useLinkTicket: () => ({ generateConnectionLinkTicketOptions: () => [] }),
}));
jest.mock('@/project/main-panel/connections/constants', () => ({
  SUPPORT_ROW_DETAILS_SETTINGS_CONNECTION_TYPES: ['github_issue'],
  CONNECTION_PREDEFINED_COLUMN_NAME: { UNREAD: 'unread' }, CONNECTION_TYPE: { GITHUB_ISSUE: 'github_issue', EMAIL: 'email' },
}));
jest.mock('@/project/main-panel/connections/hooks', () => ({ useConnections: () => ({ connections: [{ id: 1, type: 'github_issue' }, { id: 2, type: 'email' }] }) }));
jest.mock('@/project/main-panel/connections/utils', () => ({
  formatColumns: (_connection, columns) => columns,
  getTableName: connection => connection ? `${connection.type}_${connection.id}` : '',
}));
jest.mock('@/project/main-panel/connections/components/connection-resource-details', () => ({
  __esModule: true,
  default: props => { mockMain(props); return null; },
  ConnectionResourceOtherDetails: props => { mockOthers(props); return null; },
}));
jest.mock('@/sea-metadata/constants', () => ({ CellType: { SINGLE_SELECT: 'single-select' } }));
jest.mock('@/sea-metadata/utils/cell', () => ({ getCellValueByColumn: (row, column) => row[column.key] }));
jest.mock('@/sea-metadata/utils/column', () => ({ getColumnByName: (columns, name) => columns.find(column => column.name === name) }));
jest.mock('@/utils/dialog', () => ({ isSmallContainer: () => false }));
jest.mock('@/utils/utils', () => ({}));

const lastProps = mock => mock.mock.calls[mock.mock.calls.length - 1][0];
const columns = [{ key: 'link', name: 'linked_ticket' }, { key: 'outdated', name: 'outdated' }, { key: 'unread', name: 'unread' }];
const resource = { type: 'github_issue', connection_id: 1, _id: '7' };

const ResourceSubscriber = props => {
  useResourceUpdate(props);
  return null;
};

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
    useData.mockReturnValue({ modifyLocalRow: jest.fn(), modifyRow: (_table, _id, _update, api) => api() });
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

  it.each(['settings', 'unread'])('updates only the matching list after changing %s outside its controller provider', async source => {
    const isUnread = source === 'unread';
    const tableName = isUnread ? 'email_2' : 'github_issue_1';
    const matching = jest.fn();
    const otherProject = jest.fn();
    const otherTable = jest.fn();
    await act(async () => root.render(
      <>
        <ResourceSubscriber projectUuid="project" tableName={tableName} onUpdate={matching} />
        <ResourceSubscriber projectUuid="other-project" tableName={tableName} onUpdate={otherProject} />
        <ResourceSubscriber projectUuid="project" tableName="other-table" onUpdate={otherTable} />
        <ConnectionRecordDetailsInDialog projectUuid="project"
          resource={isUnread ? { ...resource, type: 'email', connection_id: 2 } : resource}
          columns={columns} onUpdateResourceDetails={onUpdateResourceDetails} />
      </>
    ));
    load();
    const rowUpdateData = isUnread ? { unread: true } : { outdated: true };

    await act(async () => isUnread
      ? lastProps(mockMain).onThreadUnreadChange(true)
      : lastProps(mockOthers).onChange(rowUpdateData));

    expect(matching).toHaveBeenCalledTimes(1);
    expect(matching).toHaveBeenCalledWith(expect.objectContaining({
      projectUuid: 'project', tableName, rowId: '7', rowUpdateData,
    }));
    expect(otherProject).not.toHaveBeenCalled();
    expect(otherTable).not.toHaveBeenCalled();
  });
});
