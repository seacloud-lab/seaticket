import React, { act } from 'react';
import { screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { ticketsAPI } from '@/project/api';
import { useData } from '@/project/hooks';
import TicketDetails from '@/project/main-panel/tickets/components/ticket-details';

jest.mock('reactstrap', () => ({ Button: () => null }));
jest.mock('@seafile/seafile-editor', () => ({}));
jest.mock('@/components', () => ({
  CenteredLoading: () => <div role="status">Loading</div>,
  CenteredError: ({ children }) => <div role="alert">{children}</div>,
  toaster: {},
}));
jest.mock('@/constants', () => ({
  gettext: text => text,
  username: 'user@example.com',
  DIALOG_SIZE: { S: 's' },
  DIALOG_SIZE_VALUE: { s: 576 },
  PERMISSION_TYPES: { READ_ONLY: 'r', READ_WRITE: 'rw' },
}));
jest.mock('@/portal/api', () => ({ portalAPI: {} }));
jest.mock('@/project/api', () => ({ ticketsAPI: {
  listProjectTicketActivities: jest.fn(),
  modifyProjectTicket: jest.fn(),
} }));
jest.mock('@/project/constants', () => ({ EVENT_BUS_TYPE: {} }));
jest.mock('@/project/hooks', () => ({
  useMetadata: () => ({}),
  useData: jest.fn(),
  useTags: () => ({}),
}));
jest.mock('@/project/main-panel/portal-issues/constants', () => ({}));
jest.mock('@/project/main-panel/tags/tags-settings', () => () => null);
jest.mock('@/sea-metadata', () => ({}));
jest.mock('@/sea-metadata/constants', () => ({}));
jest.mock('@/sea-metadata/context', () => ({}));
jest.mock('@/sea-metadata/utils/row', () => ({ convertRowToKeyValue: row => row }));
jest.mock('@/utils/long-text', () => ({ __esModule: true, default: class {} }));
jest.mock('@/utils/seafile-editor-browser', () => ({ canCheckSeafileEditorBrowser: () => false }));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message } }));
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
  PrioritySettings: () => null,
  StateSettings: () => null,
  SubStateSettings: () => null,
  DueDateSettings: () => null,
  LinkSettings: ({ linkedRecords }) => <div>{JSON.stringify(linkedRecords)}</div>,
}));
jest.mock('@/project/main-panel/tickets/components/upload-files-btn', () => () => null);
jest.mock('@/project/main-panel/tickets/components/ticket-details/status-toggle-btn', () => () => null);
jest.mock('@/project/main-panel/tickets/components/ticket-details/ticket-log', () => ({ log }) => (
  <div data-testid={`activity-${log.id}`}>{log.id}</div>
));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const oldActivity = { id: 1, created_time: '2026-11-25T12:00:00Z' };
const newActivity = { id: 2, created_time: '2026-11-25T12:01:00Z' };

const createTicket = (id) => {
  const ticket = { id, comments: [], participants: ['user@example.com'] };
  ticket._update = update => Object.assign(ticket, update);
  return ticket;
};

const renderDetails = (ref, ticket, modifyTicket) => (
  <TicketDetails
    ref={ref}
    projectUuid="project"
    ticketType="ticket"
    ticket={ticket}
    setTicket={jest.fn()}
    modifyTicket={modifyTicket}
    isShowOthersInfo={false}
    smallScreenSize={904}
  />
);

describe('Ticket detail and activity requests', () => {
  const originalResizeObserver = global.ResizeObserver;
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  const originalApp = window.app;
  let TicketInDialog;
  let container;
  let root;

  const render = (element) => {
    act(() => root.render(element));
  };

  beforeAll(() => {
    window.app = { pageOptions: { isProjectAdmin: false } };
    TicketInDialog = require('@/project/main-panel/tickets/components/ticket-in-dialog').default;
    global.IS_REACT_ACT_ENVIRONMENT = true;
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
    };
  });

  afterAll(() => {
    window.app = originalApp;
    global.ResizeObserver = originalResizeObserver;
    global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    useData.mockReturnValue({ getTableByName: () => null });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each(['modification', 'linked task'])('keeps a new %s activity when an older list arrives later', async (source) => {
    const list = deferred();
    ticketsAPI.listProjectTicketActivities.mockReturnValue(list.promise);
    const ref = React.createRef();
    const ticket = createTicket(1);
    const modifyTicket = jest.fn().mockResolvedValue({ data: { row: {}, activities: [newActivity] } });
    render(renderDetails(ref, ticket, modifyTicket));

    await act(async () => {
      if (source === 'modification') {
        await ref.current.onChange(ticket.id, { priority: 1 });
      } else {
        ref.current.setActivities(`ticket_${ticket.id}`, previous => [...previous, newActivity]);
      }
    });
    expect(screen.getAllByTestId('activity-2')).toHaveLength(1);

    await act(async () => {
      list.resolve({ data: { activities: [oldActivity] } });
      await list.promise;
    });

    expect(screen.getAllByTestId('activity-1')).toHaveLength(1);
    expect(screen.getAllByTestId('activity-2')).toHaveLength(1);
  });

  it.each(['modification', 'linked task'])('deduplicates a %s activity already returned in the list', async (source) => {
    const list = deferred();
    ticketsAPI.listProjectTicketActivities.mockReturnValue(list.promise);
    const ref = React.createRef();
    const ticket = createTicket(1);
    const modifyTicket = jest.fn().mockResolvedValue({ data: { row: {}, activities: [newActivity] } });
    render(renderDetails(ref, ticket, modifyTicket));

    await act(async () => {
      list.resolve({ data: { activities: [oldActivity, newActivity] } });
      await list.promise;
    });
    await act(async () => {
      if (source === 'modification') {
        await ref.current.onChange(ticket.id, { priority: 1 });
      } else {
        ref.current.setActivities(`ticket_${ticket.id}`, previous => [...previous, newActivity]);
      }
    });

    expect(screen.getAllByTestId('activity-1')).toHaveLength(1);
    expect(screen.getAllByTestId('activity-2')).toHaveLength(1);
  });

  it.each(['ticket_2', 'portal_issue_1'])('ignores an activity update for resource %s', async key => {
    ticketsAPI.listProjectTicketActivities.mockResolvedValue({ data: { activities: [oldActivity] } });
    const ref = React.createRef();
    await act(async () => { render(renderDetails(ref, createTicket(1))); });

    act(() => { ref.current.setActivities(key, previous => [...previous, newActivity]); });

    expect(screen.getAllByTestId('activity-1')).toHaveLength(1);
    expect(screen.queryByTestId('activity-2')).toBeNull();
  });

  it('ignores the previous ticket request after switching tickets', async () => {
    const firstList = deferred();
    const secondList = deferred();
    ticketsAPI.listProjectTicketActivities
      .mockReturnValueOnce(firstList.promise)
      .mockReturnValueOnce(secondList.promise);
    const ref = React.createRef();
    render(renderDetails(ref, createTicket(1)));
    const firstSignal = ticketsAPI.listProjectTicketActivities.mock.calls[0][4];

    render(renderDetails(ref, createTicket(2)));
    expect(firstSignal.aborted).toBe(true);
    await act(async () => {
      secondList.resolve({ data: { activities: [newActivity] } });
      await secondList.promise;
      firstList.resolve({ data: { activities: [oldActivity] } });
      await firstList.promise;
    });

    expect(screen.queryByTestId('activity-1')).toBeNull();
    expect(screen.getAllByTestId('activity-2')).toHaveLength(1);
  });

  it('does not publish an old save when the mounted details component switches tickets', async () => {
    const save = deferred();
    const modifyTicket = jest.fn().mockReturnValue(save.promise);
    const setTicket = jest.fn();
    const setLinkedRecords = jest.fn();
    const ref = React.createRef();
    ticketsAPI.listProjectTicketActivities.mockImplementation((_projectUuid, id) => Promise.resolve({ data: {
      activities: [{ id, created_time: '2026-11-25T12:00:00Z' }],
    } }));
    const props = { projectUuid: 'project', ticketType: 'ticket', setTicket, setLinkedRecords, modifyTicket, isShowOthersInfo: false };
    render(<TicketDetails {...props} ref={ref} ticket={createTicket(1)} />);
    let saving;
    act(() => { saving = ref.current.onChange(1, { priority: 1 }); });

    await act(async () => { render(<TicketDetails {...props} ref={ref} ticket={createTicket(2)} />); });
    expect(screen.getByTestId('activity-2')).not.toBeNull();
    await act(async () => {
      save.resolve({ data: {
        row: {},
        linked_records_info: { old: 'Old ticket record' },
        activities: [{ id: 'old-save', created_time: '2026-11-25T12:01:00Z' }],
      } });
      await saving;
    });

    expect(setTicket).not.toHaveBeenCalled();
    expect(setLinkedRecords).not.toHaveBeenCalled();
    expect(screen.getByTestId('activity-2')).not.toBeNull();
    expect(screen.queryByTestId('activity-old-save')).toBeNull();
  });

  describe('TicketInDialog detail responses', () => {
    const responseFor = (id) => ({ data: {
      ticket: { _pk: id, title: `Ticket ${id}` },
      linked_records_info: { [`record-${id}`]: `Linked record ${id}` },
    } });

    const renderDialog = (ticketID, getTicket, updateTicket, ref) => render(
      <TicketInDialog ref={ref} ticketID={ticketID} projectUuid="project" permission="rw" getTicket={getTicket} updateTicket={updateTicket} />
    );

    it.each(['success', 'failure'])('keeps B details and activities when A finishes later with %s', async (outcome) => {
      const first = deferred();
      const second = deferred();
      const getTicket = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const updateTicket = jest.fn();
      ticketsAPI.listProjectTicketActivities.mockImplementation((_projectUuid, id) => Promise.resolve({ data: {
        activities: [{ id, created_time: '2026-11-25T12:00:00Z' }],
      } }));
      renderDialog('A', getTicket, updateTicket);
      renderDialog('B', getTicket, updateTicket);

      await act(async () => { second.resolve(responseFor('B')); });
      expect(screen.getByTestId('activity-B')).not.toBeNull();
      const publishedDetails = updateTicket.mock.calls.slice();

      await act(async () => {
        if (outcome === 'success') first.resolve(responseFor('A'));
        else first.reject(new Error('A failed'));
      });

      expect(screen.getByText('Ticket B')).not.toBeNull();
      expect(screen.getByText(JSON.stringify(responseFor('B').data.linked_records_info))).not.toBeNull();
      expect(screen.getByTestId('activity-B')).not.toBeNull();
      expect(screen.queryByTestId('activity-A')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(updateTicket.mock.calls).toEqual(publishedDetails);
      expect(updateTicket).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'B' }));
      expect(ticketsAPI.listProjectTicketActivities).toHaveBeenCalledTimes(1);
      expect(ticketsAPI.listProjectTicketActivities.mock.calls[0][1]).toBe('B');
    });

    it.each(['success', 'failure'])('keeps B loading when A finishes first with %s', async (outcome) => {
      const first = deferred();
      const second = deferred();
      const getTicket = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const updateTicket = jest.fn();
      ticketsAPI.listProjectTicketActivities.mockResolvedValue({ data: { activities: [] } });
      renderDialog('A', getTicket, updateTicket);
      renderDialog('B', getTicket, updateTicket);
      updateTicket.mockClear();

      await act(async () => {
        if (outcome === 'success') first.resolve(responseFor('A'));
        else first.reject(new Error('A failed'));
      });

      expect(screen.getByRole('status')).not.toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(updateTicket).not.toHaveBeenCalled();
      expect(ticketsAPI.listProjectTicketActivities).not.toHaveBeenCalled();

      await act(async () => { second.resolve(responseFor('B')); });
      expect(screen.getByText('Ticket B')).not.toBeNull();
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('ignores a detail response after the dialog is closed', async () => {
      const request = deferred();
      const updateTicket = jest.fn();
      renderDialog('A', () => request.promise, updateTicket);
      render(null);
      updateTicket.mockClear();

      await act(async () => { request.resolve(responseFor('A')); });

      expect(updateTicket).not.toHaveBeenCalled();
    });

    it('updates A cache without replacing B after A is saved late', async () => {
      const first = deferred();
      const second = deferred();
      const save = deferred();
      const getTicket = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const updateTicket = jest.fn();
      const modifyLocalRow = jest.fn();
      useData.mockReturnValue({
        getTableByName: () => ({ key_column_map: { priority: { key: 'priority', name: 'priority' } } }),
        modifyLocalRow,
      });
      ticketsAPI.modifyProjectTicket.mockReturnValue(save.promise);
      ticketsAPI.listProjectTicketActivities.mockImplementation((_projectUuid, id) => Promise.resolve({ data: {
        activities: [{ id, created_time: '2026-11-25T12:00:00Z' }],
      } }));
      const ref = React.createRef();
      renderDialog('A', getTicket, updateTicket, ref);
      await act(async () => { first.resolve(responseFor('A')); });

      let saving;
      act(() => { saving = ref.current.onChange('A', { priority: 1 }); });
      expect(ticketsAPI.modifyProjectTicket).toHaveBeenCalledWith('project', 'A', { priority: 1 });
      renderDialog('B', getTicket, updateTicket, ref);
      await act(async () => { second.resolve(responseFor('B')); });
      expect(screen.getByTestId('activity-B')).not.toBeNull();
      const publishedDetails = updateTicket.mock.calls.slice();

      await act(async () => {
        save.resolve({ data: {
          row: {},
          activities: [{ id: 'saved-A', created_time: '2026-11-25T12:01:00Z' }],
          linked_records_info: { 'saved-A': 'Updated A record' },
        } });
        await saving;
      });

      expect(modifyLocalRow).toHaveBeenCalledWith('tickets', 'A', expect.objectContaining({ priority: 1 }));
      expect(screen.getByText('Ticket B')).not.toBeNull();
      expect(screen.getByText(JSON.stringify(responseFor('B').data.linked_records_info))).not.toBeNull();
      expect(screen.getByTestId('activity-B')).not.toBeNull();
      expect(screen.queryByTestId('activity-A')).toBeNull();
      expect(screen.queryByTestId('activity-saved-A')).toBeNull();
      expect(ticketsAPI.listProjectTicketActivities.mock.calls.map(call => call[1])).toEqual(['A', 'B']);
      expect(updateTicket.mock.calls).toEqual(publishedDetails);
      expect(updateTicket).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'B' }));
    });
  });
});
