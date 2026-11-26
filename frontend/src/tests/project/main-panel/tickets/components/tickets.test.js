import React, { act } from 'react';
import { screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { useData } from '@/project/hooks';
import Tickets from '@/project/main-panel/tickets/components/tickets';
import context from '@/sea-metadata/context';
import eventBus from '@/utils/event-bus';

const mockCreateTask = jest.fn();
const mockRows = [{ _id: 'A', title: 'Ticket A' }, { _id: 'B', title: 'Ticket B' }];

jest.mock('@/components', () => ({
  CenteredLoading: () => <div role="status">Loading</div>,
  CenteredError: ({ children }) => <div role="alert">{children}</div>,
}));
jest.mock('@/components/toaster', () => ({ success: jest.fn() }));
jest.mock('@/constants', () => ({
  gettext: text => text,
  DIALOG_SIZE: { S: 's' },
  DIALOG_SIZE_VALUE: { s: 576 },
  PERMISSION_TYPES: { READ_WRITE: 'rw' },
}));
jest.mock('@/portal/api', () => ({ portalAPI: {} }));
jest.mock('@/project/main-panel/portal-issues/models', () => ({}));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message } }));
jest.mock('@/project/constants', () => ({ EVENT_BUS_TYPE: { MODIFY_LOCAL_RECORD_IN_DIALOG: 'modify-dialog' } }));
jest.mock('@/project/api', () => ({ ticketsAPI: {} }));
jest.mock('@/project/hooks', () => ({ useData: jest.fn(), useTags: () => ({}) }));
jest.mock('@/project/main-panel/ask/hooks', () => ({ useAIChatTools: () => ({}) }));
jest.mock('@/project/main-panel/connections/constants', () => ({ CONNECTION_TYPE: { GENERAL_TASK: 'task' } }));
jest.mock('@/project/main-panel/connections/hooks', () => ({ useConnections: () => ({}) }));
jest.mock('@/project/main-panel/connections/utils', () => ({ getTableName: () => 'tasks' }));
jest.mock('@/project/main-panel/tickets/hooks', () => ({
  useMetadata: () => ({}),
  useCloseLinkedIssues: () => ({}),
}));
jest.mock('@/project/main-panel/tickets/constants', () => ({
  TICKET_TYPE: 'ticket',
  TICKET_STATE: { OPEN: '0001' },
  TICKET_TABLE_NAME: 'tickets',
  TICKET_NOT_DISPLAY_COLUMNS: [],
  TICKET_PREDEFINED_COLUMN_CONFIG: {},
  PREDEFINED_TICKET_COLUMN_NAME: { LINKED_CONNECTION_RECORDS: 'linked_connection_records' },
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
jest.mock('@/sea-metadata/context', () => ({ eventBus: { dispatch: jest.fn() } }));
jest.mock('@/sea-metadata/utils/cell', () => ({ getCellValueByColumn: (row, column) => row[column.key] }));
jest.mock('@/sea-metadata/utils/column', () => ({ getColumnByName: (columns, name) => columns.find(column => column.name === name) }));
jest.mock('@/project/main-panel/tickets/components/create-kb-record-dialog', () => () => null);
jest.mock('@/project/main-panel/tickets/components/related-issues-dialog', () => () => null);
jest.mock('@/sea-metadata', () => {
  const React = require('react');
  return React.forwardRef(({ api, expandRow }, ref) => {
    React.useEffect(() => { api.getMetadata(); }, [api]);
    React.useImperativeHandle(ref, () => ({ getOrderRows: () => mockRows }));
    return <button onClick={() => expandRow(mockRows[0])}>Open A</button>;
  });
});
jest.mock('@/project/main-panel/tickets/components/ticket-details', () => {
  const React = require('react');
  return React.forwardRef(({ ticket, linkedRecords }, ref) => {
    const [activities, setActivities] = React.useState([]);
    React.useEffect(() => { setActivities([]); }, [ticket.id]);
    React.useImperativeHandle(ref, () => ({
      setActivities: (key, update) => {
        if (key === `ticket_${ticket.id}`) setActivities(update);
      },
    }), [ticket.id]);
    return (
      <div>
        {(ticket.linked_connection_records || []).map(key => <div key={key}>{linkedRecords[key]?.title || key}</div>)}
        {activities.map(activity => <div key={activity.id}>{activity.id}</div>)}
      </div>
    );
  });
});
jest.mock('@/project/components/resource-details-dialog', () => {
  const React = require('react');
  return React.forwardRef(({ projectUuid, resource, getTicket, createMoreOptions, switchResource, onToggle }, ref) => {
    const TicketInDialog = require('@/project/main-panel/tickets/components/ticket-in-dialog').default;
    return (
      <div>
        <div>Details {resource._id}</div>
        <TicketInDialog ref={ref} projectUuid={projectUuid} ticketID={resource._id} permission="rw" getTicket={getTicket} updateTicket={() => {}} />
        <button onClick={() => createMoreOptions(resource)[0].callback()}>Create task</button>
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

describe('Creating a linked task from a ticket dialog', () => {
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
    listRows = { A: { links: ['existing'] } };
    context.eventBus.dispatch.mockImplementation((type, id, update) => {
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
    useData.mockReturnValue({ getMetadata: (_table, _view, load) => load(), insertRowByLink });
    const api = { getMetadata: () => Promise.resolve({ data: {
      tickets: mockRows,
      columns: [{ key: 'links', name: 'linked_connection_records' }],
    } }) };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root.render(<Tickets projectUuid="project" api={api} getTicket={getTicket} />); });
    await act(async () => { click('Open A'); });
    click('Create task');
    click('Submit task');
    expect(mockCreateTask).toHaveBeenCalledWith('A');
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
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
