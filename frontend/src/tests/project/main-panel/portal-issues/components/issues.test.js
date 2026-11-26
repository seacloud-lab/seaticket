import React, { act } from 'react';
import { screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { portalAPI } from '@/portal/api';
import { ticketsAPI } from '@/project/api';
import { useData } from '@/project/hooks';
import context from '@/sea-metadata/context';
import eventBus from '@/utils/event-bus';

const mockCreateTicket = jest.fn();
const mockRows = [{ _id: '5', title: 'Issue A', ticket: null }, { _id: '6', title: 'Issue B', ticket: null }];

jest.mock('reactstrap', () => ({
  Button: () => null,
  Modal: ({ children }) => <div role="dialog">{children}</div>,
  ModalBody: ({ children }) => <div>{children}</div>,
  Dropdown: ({ children }) => <div>{children}</div>,
  DropdownToggle: ({ children }) => <span>{children}</span>,
  DropdownItem: ({ divider, children, onClick }) => divider ? null : <button onClick={onClick}>{children}</button>,
}));
jest.mock('@seafile/seafile-editor', () => ({}));
jest.mock('@/components', () => ({
  CenteredLoading: () => <div role="status">Loading</div>,
  CenteredError: ({ children }) => <div role="alert">{children}</div>,
  CustomizeLabel: ({ children }) => <span>{children}</span>,
  CustomizeDropdownMenu: ({ children }) => <div>{children}</div>,
  ModalHeader: ({ children, toggle }) => <div><button onClick={toggle}>Close dialog</button>{children}</div>,
  IconTooltip: ({ tip, onClick }) => <button onClick={onClick}>{tip}</button>,
  IconButton: () => null,
  toaster: { danger: jest.fn() },
}));
jest.mock('@/components/toaster', () => ({}));
jest.mock('@/constants', () => ({
  gettext: text => text,
  username: 'user@example.com',
  DIALOG_SIZE: { S: 's' },
  DIALOG_SIZE_VALUE: { s: 576 },
  PERMISSION_TYPES: { READ_ONLY: 'r', READ_WRITE: 'rw' },
}));
jest.mock('@/portal/api', () => ({ portalAPI: { getPortalIssue: jest.fn(), modifyPortalIssue: jest.fn() } }));
jest.mock('@/project/api', () => ({ ticketsAPI: { getProjectTicket: jest.fn(), listProjectTicketActivities: jest.fn() } }));
jest.mock('@/project/constants', () => ({ EVENT_BUS_TYPE: { MODIFY_LOCAL_RECORD_IN_DIALOG: 'modify-dialog' } }));
jest.mock('@/project/hooks', () => ({
  useData: jest.fn(),
  useTags: () => ({}),
  useMetadata: () => ({}),
  usePortalIssuesMetadata: () => ({}),
}));
jest.mock('@/project/main-panel/ask/hooks', () => ({ useAIChatTools: () => ({}) }));
jest.mock('@/project/main-panel/connections/constants', () => ({
  SUPPORT_ROW_DETAILS_CONNECTION_TYPES: [],
  CONNECTION_TYPE: {},
}));
jest.mock('@/project/main-panel/connections/hooks', () => ({ useConnections: () => ({ connections: [] }) }));
jest.mock('@/project/main-panel/connections/utils', () => ({}));
jest.mock('@/project/main-panel/connections/components/connection-record-details-in-dialog', () => () => null);
jest.mock('@/project/main-panel/knowledge-base/components', () => ({}));
jest.mock('@/project/main-panel/knowledge-base/constants', () => ({ KNOWLEDGE_BASE_TYPE: 'knowledge_base' }));
jest.mock('@/project/main-panel/portal-issues/constants', () => ({
  PORTAL_ISSUE_TYPE: 'portal_issue',
  PORTAL_ISSUE_TABLE_NAME: 'portal_issues',
  PORTAL_ISSUE_NOT_DISPLAY_COLUMNS: [],
  PORTAL_ISSUE_PREDEFINED_COLUMN_CONFIG: {},
  PREDEFINED_PORTAL_ISSUE_COLUMN_NAME: { TITLE: 'title', LINKED_TICKET: 'linked_ticket' },
}));
jest.mock('@/project/main-panel/portal-issues/hooks', () => ({ usePortalIssuesMetadata: () => ({}) }));
jest.mock('@/project/main-panel/tags/tags-settings', () => () => null);
jest.mock('@/project/main-panel/tickets/constants', () => ({
  TICKET_TYPE: 'ticket',
  TICKET_TABLE_NAME: 'tickets',
  TICKET_STATE: { OPEN: '0001' },
  PREDEFINED_TICKET_COLUMN_NAME: { CONTENT: 'content' },
}));
jest.mock('@/project/main-panel/tickets/hooks', () => ({ useCloseLinkedIssues: () => ({}) }));
jest.mock('@/project/main-panel/tickets/utils', () => ({}));
jest.mock('@/project/main-panel/tickets/components/comment', () => ({ comment }) => <div>{comment.title}</div>);
jest.mock('@/project/main-panel/tickets/components/ticket-settings', () => ({
  CollaboratorsSettings: () => null,
  CustomerSettings: () => null,
  TypeSettings: () => null,
  PrioritySettings: ({ onChange }) => <button onClick={() => onChange(2)}>Change priority</button>,
  StateSettings: () => null,
  SubStateSettings: () => null,
  DueDateSettings: () => null,
  LinkSettings: require('@/project/main-panel/tickets/components/ticket-settings/link-settings').default,
}));
jest.mock('@/project/main-panel/tickets/components/upload-files-btn', () => () => null);
jest.mock('@/project/main-panel/tickets/components/ticket-details/status-toggle-btn', () => () => null);
jest.mock('@/project/main-panel/tickets/components/ticket-details/ticket-log', () => () => null);
jest.mock('@/project/utils', () => ({
  normalizeContextMenuOptions: options => options.filter(Boolean),
  getResourceOriginalURL: () => '',
  getInternalNetworkAddress: () => '',
  getResourceIconURL: () => 'ticket.png',
}));
jest.mock('@/sea-metadata', () => {
  const React = require('react');
  return { __esModule: true, default: React.forwardRef(({ api, expandRow }, ref) => {
    React.useEffect(() => { api.getMetadata(); }, [api]);
    React.useImperativeHandle(ref, () => ({ getOrderRows: () => mockRows }));
    return <button onClick={() => expandRow(mockRows[0])}>Open A</button>;
  }) };
});
jest.mock('@/sea-metadata/constants', () => ({
  EVENT_BUS_TYPE: { LOCAL_ROW_CHANGED: 'row-changed', UPDATE_DATA_ATTRIBUTE: 'update-attribute' },
}));
jest.mock('@/sea-metadata/context', () => ({ eventBus: { dispatch: jest.fn() }, canDeleteRow: () => false }));
jest.mock('@/sea-metadata/utils/cell', () => ({ getCellValueByColumn: (row, column) => column ? row[column.key] ?? row[column.name] : null }));
jest.mock('@/sea-metadata/utils/column', () => ({ getColumnByName: (columns, name) => columns.find(column => column.name === name) }));
jest.mock('@/utils/long-text', () => ({ __esModule: true, default: class {} }));
jest.mock('@/utils/seafile-editor-browser', () => ({ canCheckSeafileEditorBrowser: () => false }));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message, debounce: callback => callback } }));
jest.mock('@/project/main-panel/connections/components/create-ticket-dialog', () => ({ row, onSubmitCallback, onClose }) => (
  <div>
    <button onClick={() => mockCreateTicket(row._id).then(ticket => { onClose(); onSubmitCallback(ticket); })}>Confirm creation</button>
    <button onClick={onClose}>Cancel creation</button>
  </div>
));
jest.mock('@/project/main-panel/tickets/components/tickets-dialog', () => ({ onSubmit, onToggle }) => (
  <div>
    <button onClick={() => onSubmit({ id: 73, title: 'Linked Ticket' }, { key: 'connections' }, onToggle)}>Confirm linking</button>
    <button onClick={onToggle}>Cancel linking</button>
  </div>
));

const deferred = () => {
  let resolve;
  const promise = new Promise(res => { resolve = res; });
  return { promise, resolve };
};

const issueResponse = (id, linkedTicket = null) => ({ data: {
  issue: { _pk: Number(id), title: id === '5' ? 'Issue A' : 'Issue B', linked_ticket: linkedTicket },
  linked_ticket_title: linkedTicket ? 'Linked Ticket' : '',
} });

describe('Linking a Ticket from the Project Issue list dialog', () => {
  const originalApp = window.app;
  const originalResizeObserver = global.ResizeObserver;
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  let Issues;
  let root;
  let container;
  let request;
  let data;
  let dispatchSpy;

  const click = async name => act(async () => { screen.getByRole('button', { name }).click(); });
  const startOperation = async operation => {
    await click(operation === 'creation' ? 'Create related ticket' : 'Link an existing ticket');
    await click(`Confirm ${operation}`);
  };
  const finishOperation = async operation => act(async () => {
    request.resolve(operation === 'creation' ? { _pk: 73, title: 'Linked Ticket' } : { data: { row: {} } });
    await request.promise;
  });

  beforeAll(() => {
    dispatchSpy = jest.spyOn(eventBus, 'dispatch');
    window.app = { pageOptions: { isProjectAdmin: false, projectUuid: 'project', permission: 'rw' } };
    global.IS_REACT_ACT_ENVIRONMENT = true;
    global.ResizeObserver = class { observe() {} unobserve() {} };
    Issues = require('@/project/main-panel/portal-issues/components/issues').default;
  });

  afterAll(() => {
    dispatchSpy.mockRestore();
    window.app = originalApp;
    global.ResizeObserver = originalResizeObserver;
    global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    request = deferred();
    mockCreateTicket.mockReturnValue(request.promise);
    portalAPI.modifyPortalIssue.mockReturnValue(request.promise);
    portalAPI.getPortalIssue.mockImplementation((_project, id) => Promise.resolve(issueResponse(id)));
    ticketsAPI.getProjectTicket.mockResolvedValue({ data: { ticket: { _pk: 73, title: 'Ticket 73' } } });
    ticketsAPI.listProjectTicketActivities.mockResolvedValue({ data: { activities: [] } });
    data = {
      getMetadata: (_table, _view, load) => load(),
      getTableByName: () => null,
      insertRowByLink: jest.fn((_linkedTable, _table, _records, _id, _update, callback) => callback()),
      modifyRowLink: jest.fn((_row, _linkedRow, callback) => callback()),
    };
    useData.mockReturnValue(data);
    const api = { getMetadata: () => Promise.resolve({ data: {
      records: mockRows,
      columns: [{ key: 'title', name: 'title' }, { key: 'ticket', name: 'linked_ticket' }],
    } }) };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root.render(<Issues projectUuid="project" api={api} />); });
    await click('Open A');
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each(['creation', 'linking'])('updates local details and menus after %s without refetching', async operation => {
    await startOperation(operation);
    await finishOperation(operation);

    expect(screen.queryByRole('button', { name: 'Create related ticket' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Link an existing ticket' })).toBeNull();
    expect(dispatchSpy).toHaveBeenCalledWith('modify-dialog', 'portal_issue_5', { linked_ticket: 73 }, { 73: { title: 'Linked Ticket' } });
    await act(async () => { screen.getByTitle('Linked Ticket').click(); });
    expect(ticketsAPI.getProjectTicket).toHaveBeenCalledWith('project', 73);
    expect(portalAPI.getPortalIssue.mock.calls).toEqual([['project', '5']]);
  });

  describe.each(['creation', 'linking'])('late %s response', operation => {
    it.each(['switch', 'switch back', 'reopen'])('updates only the matching Issue after %s', async action => {
      await startOperation(operation);
      await click(`Cancel ${operation}`);
      if (action === 'reopen') {
        await click('Close dialog');
        await click('Open A');
      } else {
        await click('Next record');
        if (action === 'switch back') await click('Next record');
      }
      const detailRequestCount = portalAPI.getPortalIssue.mock.calls.length;

      await finishOperation(operation);

      expect(portalAPI.getPortalIssue).toHaveBeenCalledTimes(detailRequestCount);
      if (action === 'switch') {
        expect(screen.queryByTitle('Linked Ticket')).toBeNull();
        expect(screen.getByRole('button', { name: 'Link an existing ticket' })).not.toBeNull();
      } else {
        expect(screen.getByTitle('Linked Ticket')).not.toBeNull();
        expect(screen.queryByRole('button', { name: 'Link an existing ticket' })).toBeNull();
      }
      expect(dispatchSpy).toHaveBeenCalledWith('modify-dialog', 'portal_issue_5', { linked_ticket: 73 }, { 73: { title: 'Linked Ticket' } });
      expect(context.eventBus.dispatch).toHaveBeenCalledWith('row-changed', '5', { ticket: operation === 'creation' ? [73] : 73 });
      if (operation === 'creation') {
        expect(data.insertRowByLink.mock.calls[0][3]).toBe('5');
      } else {
        expect(portalAPI.modifyPortalIssue).toHaveBeenCalledWith('project', '5', { linked_ticket: 73 });
      }
    });
  });

  it('keeps a delayed creation cache callback scoped to the original Issue', async () => {
    let notify;
    data.insertRowByLink.mockImplementation((_linkedTable, _table, _records, _id, _update, callback) => { notify = callback; });
    await startOperation('creation');
    await finishOperation('creation');
    await click('Next record');
    const detailRequestCount = portalAPI.getPortalIssue.mock.calls.length;

    await act(async () => notify());

    expect(portalAPI.getPortalIssue).toHaveBeenCalledTimes(detailRequestCount);
    expect(screen.queryByTitle('Linked Ticket')).toBeNull();
    expect(dispatchSpy).toHaveBeenCalledWith('modify-dialog', 'portal_issue_5', { linked_ticket: 73 }, { 73: { title: 'Linked Ticket' } });
    expect(context.eventBus.dispatch).toHaveBeenCalledWith('row-changed', '5', { ticket: [73] });
  });

  it.each(['creation', 'linking'])('keeps the local association after a later field save following %s', async operation => {
    await startOperation(operation);
    await finishOperation(operation);
    portalAPI.modifyPortalIssue.mockResolvedValueOnce({ data: { row: {} } });

    await click('Change priority');

    expect(portalAPI.modifyPortalIssue).toHaveBeenLastCalledWith('project', 5, { priority: 2 });
    expect(screen.getByTitle('Linked Ticket')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Link an existing ticket' })).toBeNull();
    expect(portalAPI.getPortalIssue).toHaveBeenCalledTimes(1);
  });

  it.each(['creation', 'linking'])('keeps the local %s result when reopened details arrive later', async operation => {
    await startOperation(operation);
    await click(`Cancel ${operation}`);
    await click('Close dialog');
    const details = deferred();
    portalAPI.getPortalIssue.mockReturnValueOnce(details.promise);
    await click('Open A');
    expect(screen.getByRole('status')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Create related ticket' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Link an existing ticket' })).toBeNull();

    await finishOperation(operation);
    expect(screen.getByRole('status')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Link an existing ticket' })).toBeNull();

    await act(async () => {
      details.resolve(issueResponse('5'));
      await details.promise;
    });

    expect(screen.getByTitle('Linked Ticket')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Link an existing ticket' })).toBeNull();
    expect(portalAPI.getPortalIssue).toHaveBeenCalledTimes(2);

    portalAPI.modifyPortalIssue.mockResolvedValueOnce({ data: { row: {} } });
    await click('Change priority');
    expect(portalAPI.modifyPortalIssue).toHaveBeenLastCalledWith('project', 5, { priority: 2 });
    expect(screen.getByTitle('Linked Ticket')).not.toBeNull();

    await act(async () => { screen.getByTitle('Linked Ticket').click(); });
    expect(ticketsAPI.getProjectTicket).toHaveBeenCalledWith('project', 73);
  });

  it.each(['ticket_5', 'portal_issue_6'])('ignores a local update for resource %s', async key => {
    await act(async () => {
      eventBus.dispatch('modify-dialog', key, { linked_ticket: 73 }, { 73: { title: 'Linked Ticket' } });
    });

    expect(screen.queryByTitle('Linked Ticket')).toBeNull();
    expect(screen.getByRole('button', { name: 'Link an existing ticket' })).not.toBeNull();
    expect(portalAPI.getPortalIssue).toHaveBeenCalledTimes(1);
  });
});
