import React, { act } from 'react';
import { screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { TicketCreationProvider } from '@/project/components/ticket-creation-provider';
import { EVENT_BUS_TYPE } from '@/project/constants';
import { useData } from '@/project/hooks';
import { useTicketCreation } from '@/project/hooks/ticket-creation';
import { useTicketTaskCreated } from '@/project/hooks/ticket-task-created';
import eventBus from '@/utils/event-bus';

const mockTaskProps = jest.fn();
const mockKBProps = jest.fn();
jest.mock('@/components', () => ({}));
jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/project/constants', () => ({ EVENT_BUS_TYPE: {
  MODIFY_LOCAL_RECORD_IN_DIALOG: 'modify-dialog', TICKET_TASK_CREATED: 'task-created',
} }));
jest.mock('@/project/hooks', () => ({ useData: jest.fn() }));
jest.mock('@/project/main-panel/connections/constants', () => ({ CONNECTION_TYPE: { GENERAL_TASK: 'general_task' } }));
jest.mock('@/project/main-panel/connections/utils', () => ({ getTableName: connection => `tasks-${connection.id}` }));
jest.mock('@/project/main-panel/tickets/components/create-kb-record-dialog', () => props => {
  mockKBProps(props);
  return <div data-testid="kb">{props.ticket.title}</div>;
});
jest.mock('@/project/main-panel/tickets/components/create-task-dialog', () => props => {
  const React = require('react');
  const [draft] = React.useState(props.ticket.title);
  mockTaskProps(props);
  return <div data-testid="task">{draft}</div>;
});
jest.mock('@/project/main-panel/tickets/models', () => ({}));
jest.mock('@/sea-metadata/constants', () => ({}));
jest.mock('@/sea-metadata/utils/cell', () => ({
  getCellValueByColumn: (row, column) => row && column ? row[column.key] ?? row[column.name] : null,
}));
jest.mock('@/sea-metadata/utils/column', () => ({
  getColumnByName: (columns, name) => columns.find(column => column.name === name),
  getColumnOptions: column => column?.data?.options || [],
  getOption: (options, value) => options.find(option => option.id === value),
}));
jest.mock('@/sea-metadata/utils/row', () => ({}));

const columns = [
  { key: 'title-key', name: 'title' },
  { key: 'content-key', name: 'content' },
  { key: 'assignees-key', name: 'assignees' },
  { key: 'links', name: 'linked_connection_records' },
  { key: 'state-key', name: 'state' },
  { key: 'substate-key', name: 'substate' },
  { key: 'modified-key', name: 'modified_time' },
  { key: 'closed-key', name: 'closed_time' },
];
const result = {
  task: { _pk: 7, title: 'Created task' },
  connection: { id: 2, type: 'general_task' },
  ticket: { state: '0002', substate: 'done', modified_time: 'modified', closed_time: 'closed' },
  activities: [{ id: 'activity' }],
};

describe('Ticket creation workflow', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  let container;
  let root;
  let actions;
  let cachedRows;
  let insertRowByLink;
  let dispatchSpy;
  let getTableByName;

  const Consumer = () => { actions = useTicketCreation(); return null; };
  const renderProvider = (showConsumer = true, children = null) => act(() => root.render(
    <TicketCreationProvider projectUuid="project" workspaceID="workspace" projectName="Project name">
      {showConsumer && <Consumer />}
      {children}
    </TicketCreationProvider>
  ));
  const taskProps = () => mockTaskProps.mock.calls[mockTaskProps.mock.calls.length - 1][0];
  const kbProps = () => mockKBProps.mock.calls[mockKBProps.mock.calls.length - 1][0];

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    cachedRows = { A: { links: ['existing'] } };
    getTableByName = jest.fn(() => ({ key_column_map: Object.fromEntries(columns.map(column => [column.key, column])) }));
    insertRowByLink = jest.fn((_linkedTable, _table, _titles, id, update, callback) => {
      cachedRows[id] = { ...cachedRows[id], ...update(cachedRows[id]) };
      callback();
    });
    useData.mockReturnValue({ getTableByName, insertRowByLink });
    dispatchSpy = jest.spyOn(eventBus, 'dispatch');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    renderProvider();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    dispatchSpy.mockRestore();
    global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  });

  it('captures canonical IDs, column values, and nested fields when opening from a list', () => {
    const ticket = { _pk: 42, _id: 'legacy', 'title-key': 'List title', 'content-key': { text: 'List content' }, 'assignees-key': ['user'] };
    act(() => actions.createTask({ ticket, columns }));
    ticket['title-key'] = 'Changed title';
    ticket['assignees-key'].push('another user');
    renderProvider(false);

    expect(taskProps()).toEqual(expect.objectContaining({
      projectUuid: 'project', workspaceID: 'workspace', projectName: 'Project name', connectionType: 'general_task',
      ticket: expect.objectContaining({ _id: '42', title: 'List title', content: 'List content', assignees: ['user'] }),
    }));
    expect(screen.getByTestId('task').textContent).toBe('List title');
  });

  it('supports detail models without cached columns for both creation dialogs', () => {
    getTableByName.mockReturnValue(null);
    const ticket = { _pk: 9, title: 'Detail title', content: { text: 'Detail content' }, priority: 0, size: 'large', version: 'v1' };
    act(() => actions.createKnowledgeBaseRecord({ ticket }));
    expect(kbProps().ticket).toEqual({ _id: '9', title: 'Detail title', content: 'Detail content' });

    act(() => actions.createTask({ ticket }));
    expect(taskProps().ticket).toEqual(expect.objectContaining({ _id: '9', title: 'Detail title', content: 'Detail content', priority: 0, size: 'large', version: 'v1' }));
    expect(screen.queryByTestId('kb')).toBeNull();
  });

  it.each(['jira_issue', 'linear'])('remounts the task form for another target and preserves %s selection', connectionType => {
    act(() => actions.createTask({ ticket: { _id: 'A', title: 'Ticket A' } }));
    act(() => actions.createTask({ ticket: { _id: 'B', title: 'Ticket B' }, connectionType }));
    expect(taskProps().connectionType).toBe(connectionType);
    expect(screen.getByTestId('task').textContent).toBe('Ticket B');
  });

  it('ignores targets without a ticket ID', () => {
    act(() => actions.createTask({ ticket: null }));
    act(() => actions.createKnowledgeBaseRecord({ ticket: {} }));
    expect(mockTaskProps).not.toHaveBeenCalled();
    expect(mockKBProps).not.toHaveBeenCalled();
  });

  it('keeps a new dialog open when an older task completes and updates only the original ticket', () => {
    act(() => actions.createTask({ ticket: { _id: 'A', links: ['snapshot'] }, columns }));
    const old = taskProps();
    act(() => old.onClose());
    act(() => actions.createTask({ ticket: { _id: 'B', title: 'Ticket B' }, columns }));
    cachedRows.A.links.push('concurrent');

    act(() => {
      old.onSubmitCallback(result);
      old.onClose();
    });

    expect(screen.getByTestId('task').textContent).toBe('Ticket B');
    expect(insertRowByLink).toHaveBeenCalledWith('tasks-2', 'tickets', { '2_7': 'Created task' }, 'A', expect.any(Function), expect.any(Function));
    expect(cachedRows.A).toEqual({ links: ['existing', 'concurrent', '2_7'], 'state-key': '0002', 'substate-key': 'done', 'modified-key': 'modified', 'closed-key': 'closed' });
    expect(cachedRows.B).toBeUndefined();
    const payload = dispatchSpy.mock.calls.find(([type]) => type === EVENT_BUS_TYPE.TICKET_TASK_CREATED)[1];
    expect(payload).toEqual(expect.objectContaining({ projectUuid: 'project', rowId: 'A', activities: result.activities }));
    expect(payload.updateTicket({ linked_connection_records: ['another-link'] })).toEqual({
      state: '0002', substate: 'done', modified_time: 'modified', closed_time: 'closed', linked_connection_records: ['another-link', '2_7'],
    });
  });

  it('does not let an old knowledge base submission close the next dialog', () => {
    act(() => actions.createKnowledgeBaseRecord({ ticket: { _id: 'A', title: 'Ticket A' } }));
    const old = kbProps();
    act(() => old.onClose());
    act(() => actions.createTask({ ticket: { _id: 'B', title: 'Ticket B' } }));
    act(() => old.onClose());
    expect(screen.getByTestId('task').textContent).toBe('Ticket B');
  });

  it('still publishes task results when the ticket table has not been cached', () => {
    getTableByName.mockReturnValue(null);
    act(() => actions.createTask({ ticket: { id: 9, title: 'Ticket 9' } }));
    act(() => taskProps().onSubmitCallback(result));
    expect(dispatchSpy).toHaveBeenCalledWith(EVENT_BUS_TYPE.MODIFY_LOCAL_RECORD_IN_DIALOG, 'ticket_9', expect.any(Function), {
      '2_7': { _pk: 7, title: 'Created task', connection_type: 'general_task' },
    });
  });

  it('uses newly loaded table metadata when a detail-page task finishes after returning to the list', () => {
    getTableByName.mockReturnValue(null);
    act(() => actions.createTask({ ticket: { _id: 'A', title: 'Ticket A' } }));
    const pending = taskProps();
    useData.mockReturnValue({
      insertRowByLink,
      getTableByName: () => ({ key_column_map: Object.fromEntries(columns.map(column => [column.key, column])) }),
    });
    renderProvider(false);
    act(() => pending.onSubmitCallback(result));
    expect(cachedRows.A).toEqual(expect.objectContaining({ links: ['existing', '2_7'], 'state-key': '0002' }));
  });

  it('routes task notifications by project and ticket and unsubscribes when the view closes', () => {
    const onUpdate = jest.fn();
    const Subscriber = () => { useTicketTaskCreated({ projectUuid: 'project', rowId: 1, onUpdate }); return null; };
    renderProvider(true, <Subscriber />);
    act(() => {
      eventBus.dispatch(EVENT_BUS_TYPE.TICKET_TASK_CREATED, { projectUuid: 'another-project', rowId: '1' });
      eventBus.dispatch(EVENT_BUS_TYPE.TICKET_TASK_CREATED, { projectUuid: 'project', rowId: '2' });
      eventBus.dispatch(EVENT_BUS_TYPE.TICKET_TASK_CREATED, { projectUuid: 'project', rowId: '1' });
    });
    expect(onUpdate.mock.calls).toEqual([[{ projectUuid: 'project', rowId: '1' }]]);
    renderProvider();
    act(() => eventBus.dispatch(EVENT_BUS_TYPE.TICKET_TASK_CREATED, { projectUuid: 'project', rowId: '1' }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
