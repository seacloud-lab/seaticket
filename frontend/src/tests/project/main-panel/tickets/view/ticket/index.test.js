import React, { act } from 'react';
import { screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { toaster } from '@/components';
import { ticketsAPI } from '@/project/api';
import { EVENT_BUS_TYPE } from '@/project/constants';
import { useData } from '@/project/hooks';
import Ticket from '@/project/main-panel/tickets/view/ticket';
import eventBus from '@/utils/event-bus';

const mockCreateKB = jest.fn();
const mockCreateTask = jest.fn();
jest.mock('@/components', () => ({
  CenteredLoading: () => <div role="status">Loading</div>,
  EmptyTip: ({ text }) => <div>{text}</div>,
  toaster: { danger: jest.fn() },
}));
jest.mock('@/components/common/notification/hooks/notification', () => ({
  useNotification: () => ({ loading: false, markProjectNoticeAsReadByTicket: () => {} }),
}));
jest.mock('@/constants', () => ({ gettext: text => text, PERMISSION_TYPES: { READ_WRITE: 'rw' } }));
jest.mock('@/project/api', () => ({ ticketsAPI: { getProjectTicket: jest.fn() } }));
jest.mock('@/project/constants', () => ({ EVENT_BUS_TYPE: { TICKET_TASK_CREATED: 'task-created', RESOURCE_UPDATED: 'resource-updated' } }));
jest.mock('@/project/hooks', () => ({ useData: jest.fn(), useTags: () => ({}), useMetadata: () => ({}) }));
jest.mock('@/project/hooks/related-issues', () => ({ useRelatedIssues: () => ({ openRelatedIssues: () => {} }) }));
jest.mock('@/project/hooks/ticket-creation', () => ({
  useTicketCreation: () => ({ createKnowledgeBaseRecord: mockCreateKB, createTask: mockCreateTask }),
}));
jest.mock('@/project/main-panel/ask/hooks', () => ({ useAIChatTools: () => ({}) }));
jest.mock('@/project/main-panel/connections/hooks', () => ({ useConnections: () => ({}) }));
jest.mock('@/project/main-panel/tickets/components', () => ({ KeyboardShortcuts: () => null }));
jest.mock('@/project/main-panel/tickets/components/ticket-details', () => {
  const React = require('react');
  return React.forwardRef(({ ticket, linkedRecords }, ref) => (
    <div>
      <div>{ticket.title}</div>
      <div data-testid="state">{ticket.state}</div>
      {(ticket.linked_connection_records || []).map(key => <div key={key}>{linkedRecords[key]?.title || key}</div>)}
    </div>
  ));
});
jest.mock('@/project/main-panel/tickets/view/ticket/header', () => {
  const React = require('react');
  return React.forwardRef(({ className, createMoreOptions }, ref) => {
    React.useImperativeHandle(ref, () => ({ getDom: () => ({ offsetHeight: 0 }) }));
    if (className) return null;
    const options = createMoreOptions();
    return (
      <div>{options.filter(option => option.callback).map(option => (
        <button key={option.key} onClick={option.callback}>{option.key}</button>
      ))}
      </div>
    );
  });
});
jest.mock('@/project/main-panel/tickets/utils', () => ({
  generatorTicketsContextMenuOptions: ({ createKnowledgeBaseRecord, createTask }) => [
    { key: 'Create KB', callback: () => createKnowledgeBaseRecord() },
    { key: 'Create task', callback: () => createTask(null, 'jira_issue') },
  ],
}));
jest.mock('@/sea-metadata/utils/row', () => ({ convertRowToKeyValue: row => row, getRowById: () => null }));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message } }));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const response = (id, linkedRecords = {}) => ({ data: {
  ticket: { _pk: id, title: `Ticket ${id}`, content: 'Ticket content', linked_connection_records: Object.keys(linkedRecords) },
  linked_records_info: linkedRecords,
} });
const taskUpdate = (rowId, linkedKey = '2_7') => ({
  projectUuid: 'project', rowId,
  updateTicket: current => ({
    state: '0002',
    linked_connection_records: Array.from(new Set([...(current?.linked_connection_records || []), linkedKey])),
  }),
  linkedRecords: { [linkedKey]: { title: `Created ${linkedKey}` } },
});

describe('Ticket page creation actions and updates', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  let container;
  let root;
  let modifyLocalRow;
  let togglePageSlugId;
  const render = id => act(() => root.render(<Ticket projectUuid="project" ticketID={id} permission="rw" togglePageSlugId={togglePageSlugId} />));
  const notify = update => act(() => eventBus.dispatch(EVENT_BUS_TYPE.TICKET_TASK_CREATED, update));

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    modifyLocalRow = jest.fn();
    togglePageSlugId = jest.fn();
    useData.mockReturnValue({
      getTableByName: () => ({ key_column_map: { title: { key: 'title', name: 'title' } } }), modifyLocalRow,
    });
    ticketsAPI.getProjectTicket.mockImplementation((_projectUuid, id) => Promise.resolve(response(id)));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  });

  it('opens both creation workflows with the current detail ticket', async () => {
    await act(async () => render('A'));
    act(() => screen.getByRole('button', { name: 'Create KB' }).click());
    act(() => screen.getByRole('button', { name: 'Create task' }).click());
    expect(mockCreateKB).toHaveBeenCalledWith({ ticket: expect.objectContaining({ _pk: 'A', title: 'Ticket A', content: 'Ticket content' }) });
    expect(mockCreateTask).toHaveBeenCalledWith({ ticket: expect.objectContaining({ _pk: 'A' }), connectionType: 'jira_issue' });
  });

  it('updates only the matching project and ticket', async () => {
    await act(async () => render('A'));
    notify(taskUpdate('B'));
    notify({ ...taskUpdate('A'), projectUuid: 'another-project' });
    expect(screen.queryByText('Created 2_7')).toBeNull();

    notify(taskUpdate('A'));
    notify(taskUpdate('A', '2_8'));
    expect(screen.getAllByText('Created 2_7')).toHaveLength(1);
    expect(screen.getAllByText('Created 2_8')).toHaveLength(1);
    expect(screen.getByTestId('state').textContent).toBe('0002');
  });

  it('returns to the list only when the displayed ticket is deleted from a dialog', async () => {
    await act(async () => render('A'));
    const deletion = { projectUuid: 'project', tableName: 'tickets', rowId: 'A', deleted: true };
    for (const update of [
      { ...deletion, projectUuid: 'other-project' },
      { ...deletion, tableName: 'portal_issues' },
      { ...deletion, rowId: 'B' },
      { ...deletion, deleted: false, rowUpdate: { title: 'Changed' } },
    ]) act(() => eventBus.dispatch(EVENT_BUS_TYPE.RESOURCE_UPDATED, update));
    expect(togglePageSlugId).not.toHaveBeenCalled();

    act(() => eventBus.dispatch(EVENT_BUS_TYPE.RESOURCE_UPDATED, deletion));

    expect(togglePageSlugId).toHaveBeenCalledTimes(1);
    expect(togglePageSlugId).toHaveBeenCalledWith('all');
  });

  it('ignores deletion of the previously displayed ticket after navigation', async () => {
    await act(async () => render('A'));
    await act(async () => render('B'));

    act(() => eventBus.dispatch(EVENT_BUS_TYPE.RESOURCE_UPDATED, {
      projectUuid: 'project', tableName: 'tickets', rowId: 'A', deleted: true,
    }));

    expect(togglePageSlugId).not.toHaveBeenCalled();
    expect(screen.getByText('Ticket B')).not.toBeNull();
  });

  it('preserves task updates in both the page and cache when older detail data arrives later', async () => {
    const request = deferred();
    ticketsAPI.getProjectTicket.mockReturnValue(request.promise);
    render('A');
    notify(taskUpdate('A'));
    await act(async () => {
      request.resolve(response('A', { server: { title: 'Server link' } }));
      await request.promise;
    });

    expect(screen.getByText('Server link')).not.toBeNull();
    expect(screen.getByText('Created 2_7')).not.toBeNull();
    expect(screen.getByTestId('state').textContent).toBe('0002');
    expect(modifyLocalRow).toHaveBeenLastCalledWith('tickets', 'A', expect.objectContaining({ state: '0002', linked_connection_records: ['server', '2_7'] }));
  });

  it.each(['resolve', 'reject'])('ignores an older detail %s and task notification after switching tickets', async outcome => {
    const old = deferred();
    const current = deferred();
    ticketsAPI.getProjectTicket.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    render('A');
    render('B');
    notify(taskUpdate('A'));
    await act(async () => {
      current.resolve(response('B'));
      await current.promise;
      if (outcome === 'resolve') old.resolve(response('A'));
      else old.reject(new Error('Old request failed'));
      await old.promise.catch(() => {});
    });
    expect(screen.getByText('Ticket B')).not.toBeNull();
    expect(screen.queryByText('Ticket A')).toBeNull();
    expect(screen.queryByText('Created 2_7')).toBeNull();
    expect(toaster.danger).not.toHaveBeenCalled();
    expect(modifyLocalRow).toHaveBeenCalledTimes(1);
  });
});
