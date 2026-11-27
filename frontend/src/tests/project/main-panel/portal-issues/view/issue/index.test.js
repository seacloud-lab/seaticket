import React, { act } from 'react';
import { screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { portalAPI } from '@/portal/api';
import { EVENT_BUS_TYPE } from '@/project/constants';
import { useData } from '@/project/hooks';
import eventBus from '@/utils/event-bus';

jest.mock('reactstrap', () => ({ Button: () => null }));
jest.mock('@seafile/seafile-editor', () => ({ LongTextInlineEditor: () => null }));
jest.mock('@/components', () => ({
  CenteredLoading: () => <div role="status">Loading</div>,
  CenteredError: ({ children }) => <div role="alert">{children}</div>,
  CustomizeLabel: ({ children }) => <span>{children}</span>,
  IconTooltip: () => null,
  toaster: { danger: jest.fn() },
}));
jest.mock('@/constants', () => ({
  gettext: text => text,
  username: 'user@example.com',
  DIALOG_SIZE: { S: 's' },
  DIALOG_SIZE_VALUE: { s: 576 },
  PERMISSION_TYPES: { READ_ONLY: 'r', READ_WRITE: 'rw' },
}));
jest.mock('@/portal/api', () => ({ portalAPI: { getPortalIssue: jest.fn(), modifyPortalIssue: jest.fn() } }));
jest.mock('@/project/api', () => ({ ticketsAPI: {} }));
jest.mock('@/project/constants', () => ({ EVENT_BUS_TYPE: { TICKET_LINKED: 'ticket-linked', MODIFY_LOCAL_RECORD_IN_DIALOG: 'modify-dialog', RESOURCE_UPDATED: 'resource-updated' } }));
jest.mock('@/project/hooks', () => ({
  useData: jest.fn(),
  useTags: () => ({}),
  useMetadata: () => ({}),
  usePortalIssuesMetadata: () => ({}),
}));
jest.mock('@/project/hooks/related-issues', () => ({ useRelatedIssues: () => ({}) }));
jest.mock('@/project/hooks/data-context', () => ({ useData: () => require('@/project/hooks').useData() }));
jest.mock('@/project/hooks/ticket-creation', () => ({ useTicketCreation: () => ({}) }));
jest.mock('@/project/main-panel/ask/hooks', () => ({ useAIChatTools: () => ({}) }));
jest.mock('@/project/main-panel/connections/hooks', () => ({ useConnections: () => ({ connections: [] }) }));
jest.mock('@/project/main-panel/connections/utils', () => ({}));
jest.mock('@/project/main-panel/portal-issues/constants', () => ({
  PORTAL_ISSUE_TYPE: 'portal_issue',
  PORTAL_ISSUE_TABLE_NAME: 'portal_issues',
  PORTAL_ISSUE_STATE_CONFIG: {},
  PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID: { ALL: 'all' },
  PREDEFINED_PORTAL_ISSUE_COLUMN_NAME: { LINKED_TICKET: 'linked_ticket' },
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
jest.mock('@/project/main-panel/tickets/components', () => ({}));
jest.mock('@/project/main-panel/tickets/components/comment', () => ({ comment }) => <div>{comment.title}</div>);
jest.mock('@/project/main-panel/tickets/components/ticket-settings', () => ({
  CollaboratorsSettings: () => null,
  CustomerSettings: () => null,
  TypeSettings: () => null,
  PrioritySettings: () => null,
  StateSettings: () => null,
  SubStateSettings: () => null,
  DueDateSettings: () => null,
  LinkSettings: require('@/project/main-panel/tickets/components/ticket-settings/link-settings').default,
}));
jest.mock('@/project/main-panel/tickets/components/upload-files-btn', () => () => null);
jest.mock('@/project/main-panel/tickets/components/ticket-details/status-toggle-btn', () => () => null);
jest.mock('@/project/main-panel/tickets/components/ticket-details/ticket-log', () => () => null);
jest.mock('@/sea-metadata', () => ({}));
jest.mock('@/sea-metadata/constants', () => ({}));
jest.mock('@/sea-metadata/context', () => ({}));
jest.mock('@/sea-metadata/utils/column', () => ({ getColumnByName: (columns, name) => columns.find(column => column.name === name) }));
jest.mock('@/sea-metadata/utils/row', () => ({ convertRowToKeyValue: row => row, getRowById: () => null, generateRowKey: (table, id) => `${table}_${id}` }));
jest.mock('@/sea-metadata/utils/cell', () => ({ getCellValueByColumn: (row, column) => column ? row[column.key] ?? row[column.name] : null }));
jest.mock('@/utils/long-text', () => ({ __esModule: true, default: class {} }));
jest.mock('@/utils/seafile-editor-browser', () => ({ canCheckSeafileEditorBrowser: () => false }));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message } }));
jest.mock('@/project/components/resource-details-dialog', () => ({ resource }) => (
  <div data-testid="opened-ticket">{JSON.stringify(resource)}</div>
));
jest.mock('@/project/main-panel/tickets/view/ticket/header', () => {
  const React = require('react');
  return React.forwardRef(({ createMoreOptions }, ref) => (
    <div ref={ref}>
      {createMoreOptions?.().filter(option => option.callback).map(option => (
        <button key={option.key} onClick={option.callback}>{option.key}</button>
      ))}
    </div>
  ));
});
jest.mock('@/project/main-panel/connections/components/create-ticket-dialog', () => ({ onSubmitCallback, onClose }) => (
  <button onClick={() => { onSubmitCallback({ _pk: 73, title: 'Linked Ticket' }); onClose(); }}>Confirm creation</button>
));
jest.mock('@/project/main-panel/tickets/components/tickets-dialog', () => ({ onSubmit, onToggle }) => (
  <button onClick={() => onSubmit({ id: 73, title: 'Linked Ticket' }, { key: 'connections' }, onToggle)}>Confirm linking</button>
));

const issueResponse = (linkedTicket = null) => ({ data: {
  issue: { _pk: 5, title: 'Portal Issue', linked_ticket: linkedTicket, participants: ['user@example.com'] },
  columns: [{ key: 'ticket', name: 'linked_ticket' }],
  linked_ticket_title: linkedTicket ? 'Linked Ticket' : '',
} });

describe('Issue linked Ticket details', () => {
  const originalApp = window.app;
  const originalResizeObserver = global.ResizeObserver;
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  let Issue;
  let LinkTicketProvider;
  let TicketInDialog;
  let root;
  let container;
  let data;

  const render = async element => act(async () => { root.render(element && <LinkTicketProvider projectUuid="project">{element}</LinkTicketProvider>); });
  const renderPage = () => render(<Issue projectUuid="project" issueID={5} permission="rw" />);
  const renderDialog = () => render(
    <TicketInDialog
      projectUuid="project"
      ticketID={5}
      ticketType="portal_issue"
      permission="rw"
      getTicket={portalAPI.getPortalIssue}
      updateTicket={() => {}}
    />
  );
  const click = async element => act(async () => { element.click(); });
  const openLinkedTicket = async () => {
    await click(screen.getByTitle('Linked Ticket'));
    expect(JSON.parse(screen.getByTestId('opened-ticket').textContent)).toEqual(expect.objectContaining({ _id: 73, type: 'ticket' }));
  };

  beforeAll(() => {
    window.app = { pageOptions: { isProjectAdmin: false, projectUuid: 'project' } };
    global.IS_REACT_ACT_ENVIRONMENT = true;
    global.ResizeObserver = class { observe() {} unobserve() {} };
    Issue = require('@/project/main-panel/portal-issues/view/issue').default;
    LinkTicketProvider = require('@/project/components/link-ticket-provider').LinkTicketProvider;
    TicketInDialog = require('@/project/main-panel/tickets/components/ticket-in-dialog').default;
  });

  afterAll(() => {
    window.app = originalApp;
    global.ResizeObserver = originalResizeObserver;
    global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    portalAPI.getPortalIssue.mockResolvedValue(issueResponse(73));
    portalAPI.modifyPortalIssue.mockResolvedValue({ data: { row: {}, activities: [] } });
    data = {
      getTableByName: () => ({ key_column_map: {} }),
      insertRowByLink: jest.fn((_linkedTable, _table, _records, _id, _update, callback) => callback()),
      modifyRowLink: jest.fn((_row, _linkedRow, callback) => callback()),
    };
    useData.mockReturnValue(data);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each(['page', 'dialog'])('shows the existing Ticket and opens its original ID after reopening the Issue %s', async (view) => {
    const renderIssue = view === 'page' ? renderPage : renderDialog;
    await renderIssue();
    expect(screen.getByTitle('Linked Ticket')).not.toBeNull();
    await render(null);
    await renderIssue();

    await openLinkedTicket();
    expect(portalAPI.getPortalIssue).toHaveBeenCalledTimes(2);
    expect(portalAPI.getPortalIssue).toHaveBeenLastCalledWith('project', 5);
  });

  it.each(['creation', 'linking'])('shows the Ticket after %s and after reopening its Issue dialog', async (operation) => {
    portalAPI.getPortalIssue.mockResolvedValue(issueResponse());
    await renderPage();
    expect(screen.queryByTitle('Linked Ticket')).toBeNull();
    await click(screen.getByRole('button', { name: operation === 'creation' ? 'create_ticket' : 'link_an_existing_ticket' }));
    await click(screen.getByRole('button', { name: `Confirm ${operation}` }));

    await openLinkedTicket();
    if (operation === 'creation') {
      expect(data.insertRowByLink).toHaveBeenCalledWith('tickets', 'portal_issues', { 73: 'Linked Ticket' }, '5', { ticket: [73] }, expect.any(Function));
    } else {
      expect(data.modifyRowLink.mock.calls[0][1].linkedRecords).toEqual({ 73: 'Linked Ticket' });
      expect(portalAPI.modifyPortalIssue).toHaveBeenCalledWith('project', '5', { linked_ticket: 73 });
    }

    await render(null);
    portalAPI.getPortalIssue.mockResolvedValue(issueResponse(73));
    await renderDialog();
    await openLinkedTicket();
  });

  it('leaves the page when its issue is deleted from a nested dialog', async () => {
    const togglePageSlugId = jest.fn();
    await render(<Issue projectUuid="project" issueID={5} permission="rw" togglePageSlugId={togglePageSlugId} />);
    const deletion = { projectUuid: 'project', tableName: 'portal_issues', rowId: '5', deleted: true };
    for (const update of [
      { ...deletion, projectUuid: 'other-project' },
      { ...deletion, tableName: 'tickets' },
      { ...deletion, rowId: '6' },
    ]) act(() => eventBus.dispatch(EVENT_BUS_TYPE.RESOURCE_UPDATED, update));
    expect(togglePageSlugId).not.toHaveBeenCalled();

    act(() => eventBus.dispatch(EVENT_BUS_TYPE.RESOURCE_UPDATED, deletion));

    expect(togglePageSlugId).toHaveBeenCalledTimes(1);
    expect(togglePageSlugId).toHaveBeenCalledWith('all');
  });
});
