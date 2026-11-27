import React, { act } from 'react';
import { screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { portalAPI } from '@/portal/api';
import { connectionsAPI, ticketsAPI } from '@/project/api';
import { EVENT_BUS_TYPE } from '@/project/constants';
import { useData } from '@/project/hooks/data-context';
import { LinkTicketContext } from '@/project/hooks/link-ticket';
import { RelatedIssuesContext } from '@/project/hooks/related-issues';
import { ResourceDialogContext, useResourceUpdate } from '@/project/hooks/resource-dialog';
import { TicketCreationContext } from '@/project/hooks/ticket-creation';
import { generateCreateRelatedTicketOption, generateLinkAnExistingTicketOption, getTableName } from '@/project/main-panel/connections/utils';
import eventBus from '@/utils/event-bus';

const mockConnectionProps = jest.fn();
const mockTicketProps = jest.fn();
const mockConnections = [
  { id: 1, type: 'github_issue' }, { id: 2, type: 'github_issue' },
  { id: 3, type: 'jira_issue' }, { id: 4, type: 'linear' }, { id: 5, type: 'email' }, { id: 6, type: 'general_task' },
];

jest.mock('reactstrap', () => ({
  Modal: ({ children }) => <div role="dialog">{children}</div>,
  ModalBody: ({ children }) => <div>{children}</div>,
  Dropdown: ({ children }) => <div>{children}</div>,
  DropdownToggle: ({ children }) => <span>{children}</span>,
  DropdownItem: ({ divider, children, onClick }) => divider ? null : <button onClick={onClick}>{children}</button>,
}));
jest.mock('@/components', () => ({
  CustomizeDropdownMenu: ({ children }) => <div>{children}</div>,
  ModalHeader: ({ children }) => <div>{children}</div>,
  IconButton: ({ title, onClick }) => <button onClick={onClick}>{title}</button>,
  IconTooltip: () => null,
  toaster: { success: jest.fn(), danger: jest.fn(), notify: jest.fn() },
}));
jest.mock('@/constants', () => ({
  gettext: text => text, siteRoot: '/',
  PERMISSION_TYPES: { READ_ONLY: 'r', READ_WRITE: 'rw' },
}));
jest.mock('@/portal/api', () => ({ portalAPI: { deletePortalIssue: jest.fn() } }));
jest.mock('@/project/api', () => ({
  connectionsAPI: { modifyConnectionRecord: jest.fn(), deleteConnectionEmail: jest.fn() },
  ticketsAPI: { deleteProjectTicket: jest.fn() },
}));
jest.mock('@/project/constants', () => ({ EVENT_BUS_TYPE: { RESOURCE_UPDATED: 'resource-updated' } }));
jest.mock('@/project/hooks/data-context', () => ({ useData: jest.fn() }));
jest.mock('@/project/main-panel/ask/hooks', () => ({ useAIChatTools: () => ({ handleResolveAttachmentsByAI: jest.fn() }) }));
jest.mock('@/project/main-panel/connections/hooks', () => ({ useConnections: () => ({ connections: mockConnections }) }));
jest.mock('@/project/main-panel/connections/components/connection-record-details-in-dialog', () => {
  const React = require('react');
  return React.forwardRef((props, ref) => { mockConnectionProps(props); return null; });
});
jest.mock('@/project/main-panel/knowledge-base/components', () => ({}));
jest.mock('@/project/main-panel/tickets/components/ticket-in-dialog', () => {
  const React = require('react');
  return React.forwardRef((props, ref) => { mockTicketProps(props); return null; });
});
jest.mock('@/project/main-panel/tickets/models', () => ({}));
jest.mock('@/project/main-panel/portal-issues/models', () => ({}));
jest.mock('@/project/utils', () => ({
  normalizeContextMenuOptions: options => options.filter(Boolean),
  getResourceOriginalURL: () => '', getInternalNetworkAddress: () => '', getResourceIconURL: () => '',
}));
jest.mock('@/sea-metadata/constants', () => ({ CellType: {} }));
jest.mock('@/sea-metadata/constants/column', () => ({ DATE_FORMAT_MAP: {} }));
jest.mock('@/sea-metadata/utils/cell', () => ({
  getCellValueByColumn: (row, column) => row && column ? row[column.key] ?? row[column.name] : null,
}));
jest.mock('@/sea-metadata/utils/column', () => ({
  getColumnByName: (columns, name) => columns.find(column => column.name === name),
  getColumnOptions: column => column?.data?.options || [],
  getOption: (options, value) => options.find(option => option.id === value),
}));
jest.mock('@/sea-metadata/utils/row', () => ({}));
jest.mock('@/utils/dialog', () => ({ getDialogSize: () => 's' }));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message, debounce: fn => fn } }));

const columns = [
  { key: 'title-key', name: 'title' }, { key: 'body-key', name: 'content' },
  { key: 'link-key', name: 'linked_ticket' }, { key: 'outdated-key', name: 'outdated' },
  { key: 'unread-key', name: 'unread' },
];
const resource = { _id: '7', connection_id: 1, type: 'github_issue', 'title-key': 'Stale title', 'link-key': null };
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const lastProps = mock => mock.mock.calls[mock.mock.calls.length - 1][0];

describe('Resource details menu sources', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  let ResourceDetailsDialog;
  let container;
  let root;
  let actions;
  let data;
  let onToggle;

  beforeAll(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    window.app = { pageOptions: { permission: 'rw' } };
    ResourceDetailsDialog = require('@/project/components/resource-details-dialog').default;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    actions = {
      createTicket: jest.fn(), linkAnExistingTicket: jest.fn(), openRelatedIssues: jest.fn(),
      createKnowledgeBaseRecord: jest.fn(), createTask: jest.fn(),
    };
    actions.generateConnectionLinkTicketOptions = ({ permission, ...params }) => permission === 'rw' ? [
      generateCreateRelatedTicketOption(params, () => actions.createTicket(params)),
      generateLinkAnExistingTicketOption(params, () => actions.linkAnExistingTicket(params)),
    ].filter(Boolean) : [];
    data = {
      getTableByName: () => null,
      modifyRow: jest.fn((_table, _id, _update, request) => request()),
      deleteRow: jest.fn((_table, _id, request) => request()),
      deleteRows: jest.fn((_table, _ids, request) => request()),
    };
    useData.mockReturnValue(data);
    connectionsAPI.modifyConnectionRecord.mockResolvedValue({});
    connectionsAPI.deleteConnectionEmail.mockResolvedValue({});
    ticketsAPI.deleteProjectTicket.mockResolvedValue({});
    onToggle = jest.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });
  afterAll(() => { global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment; });

  const render = (props = {}, policy = {}, children = null) => act(() => root.render(
    <LinkTicketContext.Provider value={actions}>
      <RelatedIssuesContext.Provider value={actions}>
        <TicketCreationContext.Provider value={actions}>
          <ResourceDialogContext.Provider value={policy}>
            <ResourceDetailsDialog projectUuid="project" resource={resource} onToggle={onToggle} {...props} />
            {children}
          </ResourceDialogContext.Provider>
        </TicketCreationContext.Provider>
      </RelatedIssuesContext.Provider>
    </LinkTicketContext.Provider>
  ));
  const loadConnection = (record = { title: 'Loaded title', outdated: false, linked_ticket: null }) => act(() => {
    lastProps(mockConnectionProps).onUpdateResourceDetails({ record, columns });
  });
  const loadTicket = (ticket = { title: 'Loaded ticket', content: 'Full content' }) => act(() => {
    lastProps(mockTicketProps).updateTicket(ticket, { columns });
  });
  const click = async label => act(async () => screen.getByRole('button', { name: label, exact: true }).click());

  it('prefers the list menu and sends it the current details and synchronization callback', async () => {
    const callback = jest.fn();
    const createMoreOptions = jest.fn(() => [{ key: 'list-operation', label: 'List operation', callback }]);
    render({ createMoreOptions });
    expect(createMoreOptions).not.toHaveBeenCalled();
    loadConnection();
    expect(createMoreOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ _id: '7', 'title-key': 'Loaded title' }),
      { record: expect.objectContaining({ title: 'Loaded title' }), columns },
      { columns, onRowChange: expect.any(Function) },
    );
    expect(screen.queryByRole('button', { name: 'Mark as outdated' })).toBeNull();
    await click('List operation');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(data.modifyRow).not.toHaveBeenCalled();
  });

  it('keeps an empty list menu instead of falling back to direct API operations', () => {
    render({ createMoreOptions: () => [] });
    loadConnection();
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });

  it.each([
    ['ticket', { _id: '8', type: 'ticket' }, 'Delete ticket'],
    ['issue', { _id: '9', type: 'portal_issue' }, 'Delete issue'],
    ['email', { ...resource, connection_id: 5, type: 'email' }, 'Delete email'],
  ])('keeps the list-provided %s deletion action', async (_type, currentResource, label) => {
    const remove = jest.fn();
    render({
      resource: currentResource,
      createMoreOptions: () => [{ key: 'list-delete', label, callback: remove }],
    });
    if (currentResource.type === 'email') loadConnection();
    else loadTicket();
    await click(label);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(data.deleteRow).not.toHaveBeenCalled();
    expect(data.deleteRows).not.toHaveBeenCalled();
  });

  it('reflects a successful list menu operation without writing back into the list', () => {
    const createMoreOptions = jest.fn(() => []);
    const updated = jest.fn();
    const unsubscribe = eventBus.subscribe(EVENT_BUS_TYPE.RESOURCE_UPDATED, updated);
    render({ createMoreOptions });
    loadConnection();
    const { onRowChange } = createMoreOptions.mock.calls[0][2];
    act(() => onRowChange({ rowUpdate: { 'title-key': 'Edited' }, columns }));
    expect(screen.getByTitle('Edited')).toBeTruthy();
    expect(updated).toHaveBeenLastCalledWith(expect.objectContaining({ rowUpdate: { title: 'Edited' }, updateList: false }));
    expect(data.modifyRow).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('does not let a delayed list callback update or close another resource', () => {
    const createMoreOptions = jest.fn(() => []);
    render({ createMoreOptions });
    loadConnection();
    const { onRowChange } = createMoreOptions.mock.calls[0][2];
    render({ resource: { ...resource, connection_id: 2 }, createMoreOptions });
    loadConnection({ title: 'Connection B' });
    act(() => onRowChange({ rowUpdate: { 'title-key': 'Late A' }, columns }));
    act(() => onRowChange({ deleted: true }));
    expect(screen.getByTitle('Connection B')).toBeTruthy();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('does not invoke an injected menu for read-only dialogs', () => {
    const createMoreOptions = jest.fn(() => []);
    render({ createMoreOptions, isReadonly: true });
    loadConnection();
    expect(createMoreOptions).not.toHaveBeenCalled();
  });

  it('generates Connection actions without a parent menu and uses the loaded values', async () => {
    render();
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    loadConnection();
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
    await click('Link an existing ticket');
    expect(actions.linkAnExistingTicket).toHaveBeenCalledWith(expect.objectContaining({
      row: expect.objectContaining({ _id: '7', 'title-key': 'Loaded title' }),
      connection: mockConnections[0], columns,
    }));
    await click('Find related issues');
    expect(actions.openRelatedIssues).toHaveBeenCalledWith(expect.objectContaining({ connection: mockConnections[0] }));
    loadConnection({ title: 'Linked title', linked_ticket: 88 });
    expect(screen.queryByRole('button', { name: 'Link an existing ticket' })).toBeNull();
  });

  it('generates KB and task actions from the full Ticket details', async () => {
    render({ resource: { _id: '8', type: 'ticket', 'title-key': 'Summary' } });
    loadTicket();
    await click('Create knowledge base record');
    expect(actions.createKnowledgeBaseRecord).toHaveBeenCalledWith({
      ticket: expect.objectContaining({ _id: '8', 'title-key': 'Loaded ticket', content: 'Full content' }), columns,
    });
    for (const [label, connectionType] of [
      ['Create task', 'general_task'], ['Create Jira task', 'jira_issue'], ['Create Linear task', 'linear'],
    ]) {
      await click(label);
      expect(actions.createTask).toHaveBeenLastCalledWith({ ticket: expect.objectContaining({ _id: '8' }), columns, connectionType });
    }
  });

  it('gets Portal Issue link columns from details when the caller has none', async () => {
    render({ resource: { _id: '9', type: 'portal_issue' } });
    loadTicket({ title: 'Issue', linked_ticket: null });
    await click('Create related ticket');
    expect(actions.createTicket).toHaveBeenCalledWith({ row: expect.objectContaining({ _id: '9', title: 'Issue' }), columns });
    await click('Link an existing ticket');
    expect(actions.linkAnExistingTicket).toHaveBeenCalledWith({ row: expect.objectContaining({ _id: '9' }), columns });
  });

  it.each([
    [{ isReadonly: true }, {}], [{}, { isReadonly: true }], [{}, { isSupportPortal: true }],
  ])('inherits restrictions for read-only and Portal dialogs (%j, %j)', (props, policy) => {
    render({ resource: { _id: '8', type: 'ticket' }, ...props }, policy);
    loadTicket();
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    expect(lastProps(mockTicketProps)).toEqual(expect.objectContaining({ permission: 'r', isReadonly: true }));
  });

  it('keeps read actions but excludes write actions without write permission', () => {
    render({ permission: 'r', resource: { _id: '8', type: 'ticket' } });
    loadTicket();
    expect(screen.getByRole('button', { name: 'Find related issues' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create knowledge base record' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create task' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete ticket' })).toBeNull();
  });

  it('applies the caller capability restrictions', () => {
    render({ resource: { _id: '9', type: 'portal_issue' }, canCreateRelatedTickets: false, canChatWithAI: false, canOpenIssue: false });
    loadTicket();
    for (const label of ['Create related ticket', 'Link an existing ticket', 'Chat issue', 'Open issue']) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
  });

  it('hides the previous menu on switching connections and ignores the old callback', async () => {
    render();
    loadConnection();
    const oldCallback = lastProps(mockConnectionProps).onUpdateResourceDetails;
    render({ resource: { ...resource, connection_id: 2 } });
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    loadConnection({ title: 'Connection B', linked_ticket: null });
    act(() => oldCallback({ record: { title: 'Late A', linked_ticket: 88 }, columns }));
    await click('Link an existing ticket');
    expect(actions.linkAnExistingTicket).toHaveBeenLastCalledWith(expect.objectContaining({
      connection: mockConnections[1], row: expect.objectContaining({ title: 'Connection B' }),
    }));
    expect(screen.queryByText('Late A')).toBeNull();
  });

  it.each([
    ['project', { projectUuid: 'another-project', resource: { _id: '7', type: 'ticket' } }],
    ['table', { resource: { _id: '7', type: 'portal_issue' } }],
    ['connection', { resource }],
  ])('isolates the same record ID when switching %s', (_name, props) => {
    render({ resource: { _id: '7', type: 'ticket' } });
    loadTicket({ title: 'Original ticket' });
    const oldUpdate = lastProps(mockTicketProps).updateTicket;

    render(props);
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    if (props.resource.connection_id != null) loadConnection({ title: 'Current resource' });
    else loadTicket({ title: 'Current resource' });
    act(() => oldUpdate({ title: 'Late original ticket' }, { columns }));

    expect(screen.getByTitle('Current resource')).toBeTruthy();
    expect(screen.queryByTitle('Late original ticket')).toBeNull();
  });

  it('distinguishes connections before their metadata is available', () => {
    render({ resource: { ...resource, connection_id: 100 } });
    loadConnection({ title: 'Connection A' });
    const oldUpdate = lastProps(mockConnectionProps).onUpdateResourceDetails;

    render({ resource: { ...resource, connection_id: 101 } });
    expect(screen.queryByTitle('Connection A')).toBeNull();
    loadConnection({ title: 'Connection B' });
    act(() => oldUpdate({ record: { title: 'Late A' }, columns }));
    expect(screen.getByTitle('Connection B')).toBeTruthy();
  });

  it('keeps the loaded details when the same record ID changes from string to number', () => {
    render({ resource: { _id: '7', type: 'ticket' } });
    loadTicket({ title: 'Loaded ticket' });
    render({ resource: { _id: 7, type: 'ticket' } });
    expect(screen.getByTitle('Loaded ticket')).toBeTruthy();
  });

  it('updates the menu after marking outdated and notifies the correct table', async () => {
    const updated = jest.fn();
    const unsubscribe = eventBus.subscribe(EVENT_BUS_TYPE.RESOURCE_UPDATED, updated);
    render();
    loadConnection();
    await click('Mark as outdated');
    expect(connectionsAPI.modifyConnectionRecord).toHaveBeenCalledWith('project', 1, '7', { outdated: true });
    expect(data.modifyRow).toHaveBeenCalledWith(getTableName(mockConnections[0]), '7', { 'outdated-key': true }, expect.any(Function));
    expect(updated).toHaveBeenCalledWith(expect.objectContaining({
      projectUuid: 'project', tableName: getTableName(mockConnections[0]), rowId: '7', rowUpdate: { outdated: true },
    }));
    expect(screen.getByRole('button', { name: 'Mark as active' })).toBeTruthy();
    unsubscribe();
  });

  it('does not apply an old update completion to the next resource', async () => {
    const request = deferred();
    connectionsAPI.modifyConnectionRecord.mockReturnValue(request.promise);
    render();
    loadConnection();
    await click('Mark as outdated');
    render({ resource: { ...resource, connection_id: 2 } });
    loadConnection();
    await act(async () => request.resolve({}));
    expect(screen.getByRole('button', { name: 'Mark as outdated' })).toBeTruthy();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it.each([
    { _id: '8', type: 'ticket' },
    { _id: '9', type: 'portal_issue' },
    { ...resource, connection_id: 5, type: 'email' },
  ])('does not offer deletion without a list menu for $type', currentResource => {
    render({ permission: 'rw', resource: currentResource });
    if (currentResource.type === 'email') loadConnection({ title: 'Email', unread: true });
    else loadTicket();
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull();
    expect(data.deleteRow).not.toHaveBeenCalled();
    expect(data.deleteRows).not.toHaveBeenCalled();
    expect(ticketsAPI.deleteProjectTicket).not.toHaveBeenCalled();
    expect(portalAPI.deletePortalIssue).not.toHaveBeenCalled();
    expect(connectionsAPI.deleteConnectionEmail).not.toHaveBeenCalled();
  });

  it('supports marking mail as read without a list menu', async () => {
    render({ resource: { ...resource, connection_id: 5, type: 'email' } });
    loadConnection({ title: 'Email', unread: true });
    await click('Mark as read');
    expect(connectionsAPI.modifyConnectionRecord).toHaveBeenCalledWith('project', 5, '7', { unread: false });
    expect(screen.queryByRole('button', { name: 'Delete email' })).toBeNull();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('scopes updates by project, table, and current row', () => {
    const onUpdate = jest.fn();
    const Probe = () => {
      useResourceUpdate({ projectUuid: 'project', tableName: 'tickets', rowId: 8, onUpdate });
      return null;
    };
    render({}, {}, <Probe />);
    for (const update of [
      { projectUuid: 'other', tableName: 'tickets', rowId: '8' },
      { projectUuid: 'project', tableName: 'issues', rowId: '8' },
      { projectUuid: 'project', tableName: 'tickets', rowId: '9' },
      { projectUuid: 'project', tableName: 'tickets', rowId: '8' },
    ]) act(() => eventBus.dispatch(EVENT_BUS_TYPE.RESOURCE_UPDATED, update));
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
