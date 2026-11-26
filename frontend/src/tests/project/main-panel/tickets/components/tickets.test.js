import React, { act } from 'react';
import { screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { portalAPI } from '@/portal/api';
import { connectionsAPI } from '@/project/api';
import { LinkTicketProvider } from '@/project/components/link-ticket-provider';
import { TicketCreationProvider } from '@/project/components/ticket-creation-provider';
import { useData } from '@/project/hooks';
import { useLinkTicket } from '@/project/hooks/link-ticket';
import Tickets from '@/project/main-panel/tickets/components/tickets';
import context from '@/sea-metadata/context';
import eventBus from '@/utils/event-bus';

const mockCreateTask = jest.fn();
const mockMetadataProps = jest.fn();
const mockOpenCloseWarning = jest.fn();
const mockTogglePageSlugId = jest.fn();
const mockRows = [{ _id: 'A', title: 'Ticket A' }, { _id: 'B', title: 'Ticket B' }];

jest.mock('@/components', () => ({
  CenteredLoading: () => <div role="status">Loading</div>,
  CenteredError: ({ children }) => <div role="alert">{children}</div>,
  toaster: { danger: jest.fn() },
}));
jest.mock('@/components/toaster', () => ({ success: jest.fn() }));
jest.mock('@/constants', () => ({
  gettext: text => text,
  DIALOG_SIZE: { S: 's' },
  DIALOG_SIZE_VALUE: { s: 576 },
  PERMISSION_TYPES: { READ_WRITE: 'rw' },
}));
jest.mock('@/portal/api', () => ({ portalAPI: { modifyPortalIssue: jest.fn() } }));
jest.mock('@/project/main-panel/portal-issues/models', () => ({}));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message } }));
jest.mock('@/project/constants', () => ({ EVENT_BUS_TYPE: {
  MODIFY_LOCAL_RECORD_IN_DIALOG: 'modify-dialog', TICKET_TASK_CREATED: 'task-created', TICKET_LINKED: 'ticket-linked',
} }));
jest.mock('@/project/api', () => ({ ticketsAPI: {}, connectionsAPI: { modifyConnectionRecord: jest.fn() } }));
jest.mock('@/project/hooks', () => ({ useData: jest.fn(), useTags: () => ({}) }));
jest.mock('@/project/hooks/related-issues', () => ({
  useRelatedIssues: () => ({ openRelatedIssues: jest.fn() }),
}));
jest.mock('@/project/main-panel/ask/hooks', () => ({ useAIChatTools: () => ({}) }));
jest.mock('@/project/main-panel/connections/constants', () => ({
  CONNECTION_TYPE: { GENERAL_TASK: 'task', GITHUB_ISSUE: 'github_issue' },
  CONNECTION_PREDEFINED_COLUMN_NAME: { TITLE: 'title', STATE: 'state', LINKED_TICKET: 'linked_ticket' },
}));
jest.mock('@/project/main-panel/portal-issues/constants', () => ({
  PORTAL_ISSUE_TYPE: 'portal_issue', PORTAL_ISSUE_TABLE_NAME: 'portal_issues',
  PREDEFINED_PORTAL_ISSUE_COLUMN_NAME: { TITLE: 'title', STATE: 'state', LINKED_TICKET: 'linked_ticket' },
}));
jest.mock('@/project/main-panel/connections/hooks', () => ({ useConnections: () => ({}) }));
jest.mock('@/project/main-panel/connections/utils', () => ({ getTableName: () => 'tasks' }));
jest.mock('@/project/main-panel/tickets/hooks', () => ({
  useMetadata: () => ({}),
  useCloseLinkedIssues: () => ({ openCloseLinkedGitHubIssuesWarningDialog: mockOpenCloseWarning }),
}));
jest.mock('@/project/main-panel/tickets/constants', () => ({
  TICKET_TYPE: 'ticket',
  TICKET_STATE: { OPEN: '0001' },
  TICKET_TABLE_NAME: 'tickets',
  TICKET_NOT_DISPLAY_COLUMNS: [],
  TICKET_PREDEFINED_COLUMN_CONFIG: {},
  PREDEFINED_TICKET_COLUMN_NAME: { TITLE: 'title', STATE: 'state', LINKED_CONNECTION_RECORDS: 'linked_connection_records' },
}));
jest.mock('@/project/main-panel/tickets/utils', () => ({
  convertTicketToTask: ticket => ticket,
  generatorTicketsContextMenuOptions: ({ createTask, rowGetterByIndex }) => [
    { key: 'create-task', callback: () => createTask(rowGetterByIndex()) },
  ],
}));
jest.mock('@/sea-metadata/constants', () => ({
  EVENT_BUS_TYPE: { LOCAL_ROW_CHANGED: 'row-changed', UPDATE_DATA_ATTRIBUTE: 'update-attribute' },
}));
jest.mock('@/sea-metadata/context', () => ({ eventBus: { dispatch: jest.fn() }, setSetting: jest.fn() }));
jest.mock('@/sea-metadata/utils/cell', () => ({ getCellValueByColumn: (row, column) => row?.[column?.key] }));
jest.mock('@/sea-metadata/utils/column', () => ({ getColumnByName: (columns, name) => columns.find(column => column.name === name) }));
jest.mock('@/sea-metadata/utils/row', () => ({
  generateRowKey: (table, id) => `${table}_${id}`,
  getRowById: (data, id) => data.id_row_map[id],
  convertRowToNameValue: row => ({ ...row, state: row.state === '0002' ? 'closed' : row.state }),
}));
jest.mock('@/project/main-panel/tickets/components/create-kb-record-dialog', () => () => null);
jest.mock('@/sea-metadata', () => {
  const React = require('react');
  return React.forwardRef(({ api, expandRow, createContextMenuOptions }, ref) => {
    mockMetadataProps({ api });
    React.useEffect(() => { api.getMetadata(); }, [api]);
    React.useImperativeHandle(ref, () => ({
      getOrderRows: () => mockRows,
      createMoreOptions: row => createContextMenuOptions({ rowGetterByIndex: () => row }),
    }));
    return <button onClick={() => expandRow(mockRows[0])}>Open A</button>;
  });
});
jest.mock('@/project/main-panel/tickets/components/ticket-details', () => {
  const React = require('react');
  return React.forwardRef(({ ticket, linkedRecords }, ref) => {
    const { useTicketTaskCreated } = require('@/project/hooks/ticket-task-created');
    const [activities, setActivities] = React.useState([]);
    React.useEffect(() => { setActivities([]); }, [ticket.id]);
    useTicketTaskCreated({ projectUuid: 'project', rowId: ticket.id, onUpdate: ({ activities }) => {
      setActivities(previous => [...previous, ...activities]);
    } });
    React.useImperativeHandle(ref, () => ({
      setActivities: (key, update) => {
        if (key === `ticket_${ticket.id}`) setActivities(update);
      },
    }), [ticket.id]);
    return (
      <div>
        {(ticket.linked_connection_records || []).map(key => (
          <div key={key} data-testid={`link-${key}`} data-type={linkedRecords[key]?.connection_type} data-state={linkedRecords[key]?.state}>
            {linkedRecords[key]?.title || key}
          </div>
        ))}
        {activities.map(activity => <div key={activity.id}>{activity.id}</div>)}
      </div>
    );
  });
});
jest.mock('@/project/components/resource-details-dialog', () => {
  const React = require('react');
  return React.forwardRef(({ projectUuid, resource, getTicket, switchResource, onToggle, createMoreOptions }, ref) => {
    const TicketInDialog = require('@/project/main-panel/tickets/components/ticket-in-dialog').default;
    return (
      <div>
        <div>Details {resource._id}</div>
        <TicketInDialog ref={ref} projectUuid={projectUuid} ticketID={resource._id} permission="rw" getTicket={getTicket} updateTicket={() => {}} />
        <button onClick={() => createMoreOptions(resource).find(option => option.key === 'create-task').callback()}>Create task</button>
        <button onClick={() => switchResource(1)}>Next ticket</button>
        <button onClick={onToggle}>Close details</button>
      </div>
    );
  });
});
jest.mock('@/project/main-panel/tickets/components/create-task-dialog', () => ({ ticket, onSubmitCallback, onClose }) => (
  <div>
    <button onClick={() => mockCreateTask(ticket._id).then(result => {
      onSubmitCallback(result);
      onClose();
    })}>
      Submit task
    </button>
    <button onClick={onClose}>Close task</button>
  </div>
));
jest.mock('@/project/main-panel/connections/components/create-ticket-dialog', () => () => null);
jest.mock('@/project/main-panel/tickets/components/tickets-dialog', () => ({ onSubmit, onToggle }) => (
  <button onClick={() => onSubmit({ id: 'A', title: 'Ticket A' }, { key: 'links', name: 'linked_connection_records' }, onToggle)}>Confirm linking</button>
));

const SourceActions = () => {
  const { linkAnExistingTicket } = useLinkTicket();
  const columns = [
    { key: 'subject', name: 'title' }, { key: 'status', name: 'state' }, { key: 'ticket', name: 'linked_ticket' },
  ];
  return (
    <>
      <button onClick={() => linkAnExistingTicket({ row: { _id: 7, subject: 'Connection record', status: 'open' }, columns, connection: { id: 2, type: 'github_issue' } })}>Link connection</button>
      <button onClick={() => linkAnExistingTicket({ row: { _id: 8, subject: 'Portal record', status: '0001' }, columns })}>Link portal</button>
      <button onClick={() => linkAnExistingTicket({ row: { _id: 9, subject: 'Closed GitHub record', status: 'closed' }, columns, connection: { id: 2, type: 'github_issue' } })}>Link closed GitHub</button>
      <button onClick={() => linkAnExistingTicket({ row: { _id: 10, subject: 'Jira record', status: 'open' }, columns, connection: { id: 3, type: 'jira_issue' } })}>Link Jira</button>
    </>
  );
};

const deferred = () => {
  let resolve;
  const promise = new Promise(res => { resolve = res; });
  return { promise, resolve };
};

const createdTask = {
  task: { _pk: 1, title: 'Linked task' },
  connection: { id: 2, type: 'task' },
  activities: [{ id: 'created-for-A' }],
};

const detailsResponse = (id, linkedRecords = {}) => ({ data: {
  ticket: { _pk: id, title: `Ticket ${id}`, linked_connection_records: Object.keys(linkedRecords) },
  linked_records_info: linkedRecords,
} });

describe('Ticket list and dialog link synchronization', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  const originalApp = window.app;
  let container;
  let root;
  let request;
  let insertRowByLink;
  let getTicket;
  let dispatchSpy;
  let cachedRows;
  let listRows;
  let linkedRecordTitles;
  let modifyTicket;

  const click = name => act(() => { screen.getByRole('button', { name }).click(); });
  const finishRequest = async () => act(async () => {
    request.resolve(createdTask);
    await request.promise;
  });

  beforeAll(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    window.app = { pageOptions: { isProjectAdmin: false } };
    dispatchSpy = jest.spyOn(eventBus, 'dispatch');
  });
  afterAll(() => {
    global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
    window.app = originalApp;
    dispatchSpy.mockRestore();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    request = deferred();
    cachedRows = { A: { links: ['existing'] } };
    listRows = { A: { title: 'Ticket A', links: ['existing'] } };
    linkedRecordTitles = { existing: 'Existing record' };
    context.eventBus.dispatch.mockImplementation((type, id, update) => {
      if (type === 'update-attribute') {
        linkedRecordTitles = { ...linkedRecordTitles, ...id.linked_records };
      }
      if (type !== 'row-changed') return;
      const changes = typeof update === 'function' ? update(listRows[id] || {}) : update;
      listRows[id] = { ...listRows[id], ...changes };
    });
    getTicket = jest.fn((_project, id) => Promise.resolve(detailsResponse(id)));
    mockCreateTask.mockReturnValue(request.promise);
    insertRowByLink = jest.fn((_linkedTable, _table, _records, id, update, callback) => {
      const changes = typeof update === 'function' ? update(cachedRows[id] || {}) : update;
      cachedRows[id] = { ...cachedRows[id], ...changes };
      callback();
    });
    connectionsAPI.modifyConnectionRecord.mockResolvedValue({ data: {} });
    portalAPI.modifyPortalIssue.mockResolvedValue({ data: {} });
    useData.mockReturnValue({
      getMetadata: (_table, _view, load) => load(), insertRowByLink,
      modifyRowLink: (_target, _source, api) => api(),
      modifyRow: (_table, _id, _update, api) => api(),
    });
    modifyTicket = jest.fn().mockResolvedValue({ data: {} });
    const api = {
      getMetadata: () => Promise.resolve({ data: {
        tickets: mockRows,
        columns: [{ key: 'links', name: 'linked_connection_records' }, { key: 'title', name: 'title' }, { key: 'state', name: 'state' }],
      } }),
      modifyRow: modifyTicket,
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <TicketCreationProvider projectUuid="project">
          <LinkTicketProvider projectUuid="project">
            <SourceActions />
            <Tickets projectUuid="project" api={api} getTicket={getTicket} togglePageSlugId={mockTogglePageSlugId} />
          </LinkTicketProvider>
        </TicketCreationProvider>
      );
    });
    await act(async () => { click('Open A'); });
    click('Create task');
    click('Submit task');
    expect(mockCreateTask).toHaveBeenCalledWith('A');
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('merges connection and portal reverse links into the mounted list and dialog without duplicates', async () => {
    click('Close task');
    for (const source of ['connection', 'portal', 'connection']) {
      click(`Link ${source}`);
      await act(async () => { click('Confirm linking'); });
    }

    expect(listRows.A.links).toEqual(['existing', '2_7', 'portal_8']);
    expect(linkedRecordTitles).toEqual({ existing: 'Existing record', '2_7': 'Connection record', portal_8: 'Portal record' });
    expect(screen.getAllByText('Connection record')).toHaveLength(1);
    expect(screen.getAllByText('Portal record')).toHaveLength(1);
    expect(screen.getByTestId('link-2_7').dataset).toMatchObject({ type: 'github_issue', state: 'open' });
    expect(screen.getByTestId('link-portal_8').dataset.type).toBe('portal_issue');
    expect(connectionsAPI.modifyConnectionRecord).toHaveBeenCalledWith('project', 2, '7', { linked_ticket: 'A' });
    expect(portalAPI.modifyPortalIssue).toHaveBeenCalledWith('project', '8', { linked_ticket: 'A' });
    expect(getTicket).toHaveBeenCalledTimes(1);
  });

  it('does not publish reverse links when the linking request fails', async () => {
    click('Close task');
    connectionsAPI.modifyConnectionRecord.mockRejectedValueOnce(new Error('Link failed'));
    click('Link connection');
    await act(async () => { click('Confirm linking'); });

    expect(listRows.A.links).toEqual(['existing']);
    expect(screen.queryByText('Connection record')).toBeNull();
    expect(eventBus.dispatch).not.toHaveBeenCalledWith('ticket-linked', expect.anything());
  });

  it('asks to close a newly linked open GitHub Issue immediately from the list', async () => {
    click('Close task');
    click('Link connection');
    await act(async () => { click('Confirm linking'); });
    const api = mockMetadataProps.mock.calls.slice(-1)[0][0].api;
    await expect(api.modifyRow('A', { state: '0002' }, false, { data: {
      id_row_map: listRows, linked_records: linkedRecordTitles,
    } })).rejects.toEqual({ response: { status: 409 } });

    expect(modifyTicket).not.toHaveBeenCalled();
    expect(mockOpenCloseWarning).toHaveBeenCalledWith(expect.objectContaining({ ticket: expect.objectContaining({
      ticket_title: 'Ticket A',
      open_github_issues: [{ connection_id: 2, record_pk: 7, title: 'Connection record', state: 'open' }],
    }) }));
    await act(async () => { await mockOpenCloseWarning.mock.calls[0][0].onCloseTicketAndGitHubIssues(); });
    expect(modifyTicket).toHaveBeenCalledWith('A', expect.objectContaining({
      state: 'closed', linked_github_issues_to_close: expect.any(Array),
    }), false);
  });

  it.each(['closed GitHub', 'Jira', 'portal'])('does not ask to close the newly linked %s record', async source => {
    click('Close task');
    click(`Link ${source}`);
    await act(async () => { click('Confirm linking'); });
    const api = mockMetadataProps.mock.calls.slice(-1)[0][0].api;
    await act(async () => { await api.modifyRow('A', { state: '0002' }, false, { data: {
      id_row_map: listRows, linked_records: linkedRecordTitles,
    } }); });

    expect(mockOpenCloseWarning).not.toHaveBeenCalled();
    expect(modifyTicket).toHaveBeenCalledWith('A', { state: 'closed' }, false);
  });

  it.each(['connection', 'portal'])('preserves overlapping reverse links when %s finishes first', async first => {
    click('Close task');
    const connection = deferred();
    const portal = deferred();
    connectionsAPI.modifyConnectionRecord.mockReturnValueOnce(connection.promise);
    portalAPI.modifyPortalIssue.mockReturnValueOnce(portal.promise);
    for (const source of ['connection', 'portal']) {
      click(`Link ${source}`);
      click('Confirm linking');
    }
    const requests = first === 'connection' ? [connection, portal] : [portal, connection];
    await act(async () => { requests[0].resolve({ data: {} }); await requests[0].promise; });
    if (first === 'connection') expect(screen.getByText('Confirm linking')).not.toBeNull();
    await act(async () => { requests[1].resolve({ data: {} }); await requests[1].promise; });

    expect(new Set(listRows.A.links)).toEqual(new Set(['existing', '2_7', 'portal_8']));
    expect(linkedRecordTitles).toEqual({ existing: 'Existing record', '2_7': 'Connection record', portal_8: 'Portal record' });
    expect(screen.getAllByText('Connection record')).toHaveLength(1);
    expect(screen.getAllByText('Portal record')).toHaveLength(1);
  });

  it('keeps a late reverse-link result out of another ticket dialog', async () => {
    click('Close task');
    const linking = deferred();
    connectionsAPI.modifyConnectionRecord.mockReturnValueOnce(linking.promise);
    click('Link connection');
    click('Confirm linking');
    await act(async () => { click('Next ticket'); });
    await act(async () => { linking.resolve({ data: {} }); await linking.promise; });

    expect(listRows.A.links).toEqual(['existing', '2_7']);
    expect(screen.getByText('Details B')).not.toBeNull();
    expect(screen.queryByText('Connection record')).toBeNull();
  });

  it('preserves reverse links received while dialog details are loading', async () => {
    click('Close task');
    click('Close details');
    const details = deferred();
    getTicket.mockReturnValueOnce(details.promise);
    click('Open A');
    click('Link portal');
    await act(async () => { click('Confirm linking'); });
    await act(async () => {
      details.resolve(detailsResponse('A', { server: { title: 'Server link' } }));
      await details.promise;
    });

    expect(screen.getByText('Server link')).not.toBeNull();
    expect(screen.getAllByText('Portal record')).toHaveLength(1);
  });

  it('keeps A task activities and linked records out of B after switching', async () => {
    click('Close task');
    click('Next ticket');
    expect(screen.getByText('Details B')).not.toBeNull();

    await finishRequest();

    expect(screen.getByText('Details B')).not.toBeNull();
    expect(screen.queryByText('created-for-A')).toBeNull();
    expect(eventBus.dispatch).toHaveBeenCalledWith('modify-dialog', 'ticket_A', expect.any(Function), {
      '2_1': { _pk: 1, title: 'Linked task', connection_type: 'task' },
    });
    expect(cachedRows.A.links).toEqual(['existing', '2_1']);
    expect(listRows.A.links).toEqual(['existing', '2_1']);
    expect(insertRowByLink.mock.calls[0][3]).toBe('A');
  });

  it.each(['switch back', 'reopen'])('updates the matching resource after returning to A via %s', async (action) => {
    click('Close task');
    const latestLinks = { '2_2': { title: 'Other linked task' }, '2_1': { title: 'Linked task' } };
    getTicket.mockImplementation((_project, id) => Promise.resolve(detailsResponse(id, id === 'A' ? latestLinks : {})));
    if (action === 'switch back') {
      await act(async () => { click('Next ticket'); });
      await act(async () => { click('Next ticket'); });
    } else {
      click('Close details');
      await act(async () => { click('Open A'); });
    }
    expect(screen.getByText('Other linked task')).not.toBeNull();
    const detailRequestCount = getTicket.mock.calls.length;

    await finishRequest();

    expect(screen.getByText('Details A')).not.toBeNull();
    expect(screen.getByText('Other linked task')).not.toBeNull();
    expect(screen.getAllByText('Linked task')).toHaveLength(1);
    expect(screen.getByText('created-for-A')).not.toBeNull();
    expect(eventBus.dispatch).toHaveBeenCalledWith('modify-dialog', 'ticket_A', expect.any(Function), {
      '2_1': { _pk: 1, title: 'Linked task', connection_type: 'task' },
    });
    expect(insertRowByLink.mock.calls[0][3]).toBe('A');
    expect(getTicket).toHaveBeenCalledTimes(detailRequestCount);
  });

  it('preserves server links when a task callback arrives while reopened details are loading', async () => {
    click('Close task');
    click('Close details');
    const details = deferred();
    getTicket.mockReturnValueOnce(details.promise);
    click('Open A');

    await finishRequest();
    await act(async () => {
      details.resolve(detailsResponse('A', { '2_2': { title: 'Other linked task' } }));
      await details.promise;
    });

    expect(screen.getByText('Other linked task')).not.toBeNull();
    expect(screen.getAllByText('Linked task')).toHaveLength(1);
    expect(getTicket).toHaveBeenCalledTimes(2);
  });

  it('updates the current A session after closing only the task dialog', async () => {
    click('Close task');
    await finishRequest();

    expect(screen.getByText('created-for-A')).not.toBeNull();
    expect(eventBus.dispatch).toHaveBeenCalledWith('modify-dialog', 'ticket_A', expect.any(Function), {
      '2_1': { _pk: 1, title: 'Linked task', connection_type: 'task' },
    });
  });

  it.each([[0, 1], [1, 0]])('preserves both task links in the list and cache for completion order %j, %j', async (first, last) => {
    click('Close task');
    const second = deferred();
    mockCreateTask.mockReturnValueOnce(second.promise);
    click('Create task');
    click('Submit task');
    click('Close task');
    const pending = [request, second];
    const results = [createdTask, {
      task: { _pk: 2, title: 'Second task' },
      connection: createdTask.connection,
    }];

    for (const index of [first, last]) {
      await act(async () => {
        pending[index].resolve(results[index]);
        await pending[index].promise;
      });
    }

    expect(new Set(cachedRows.A.links)).toEqual(new Set(['existing', '2_1', '2_2']));
    expect(new Set(listRows.A.links)).toEqual(new Set(['existing', '2_1', '2_2']));
    expect(screen.getAllByText('Linked task')).toHaveLength(1);
    expect(screen.getAllByText('Second task')).toHaveLength(1);
    expect(mockCreateTask).toHaveBeenCalledTimes(2);
    expect(getTicket).toHaveBeenCalledTimes(1);
  });

  it('publishes A resource key without updating B from a delayed cache callback', async () => {
    let notify;
    insertRowByLink.mockImplementation((_linkedTable, _table, _records, _id, _update, callback) => { notify = callback; });
    await finishRequest();
    click('Next ticket');

    act(() => notify());

    expect(screen.queryByText('created-for-A')).toBeNull();
    expect(eventBus.dispatch).toHaveBeenCalledWith('modify-dialog', 'ticket_A', expect.any(Function), {
      '2_1': { _pk: 1, title: 'Linked task', connection_type: 'task' },
    });
    expect(listRows.A.links).toEqual(['existing', '2_1']);
  });
});
