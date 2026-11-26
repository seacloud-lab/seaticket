import React, { act } from 'react';
import { screen, within } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { connectionsAPI, ticketsAPI } from '@/project/api';
import { RelatedIssuesProvider } from '@/project/components/related-issues-provider';
import { useRelatedIssues } from '@/project/hooks/related-issues';
import ConnectionRelatedIssuesDialog from '@/project/main-panel/connections/components/related-issues-dialog';
import TicketRelatedIssuesDialog from '@/project/main-panel/tickets/components/related-issues-dialog';

jest.mock('reactstrap', () => ({
  Modal: ({ children }) => <div role="dialog">{children}</div>,
  ModalBody: ({ children }) => <div>{children}</div>,
}));
jest.mock('@seafile/seafile-editor', () => ({ getPreviewContent: content => ({ previewText: content }) }));
jest.mock('@/components', () => ({
  ModalHeader: ({ children, toggle }) => <div>{children}<button onClick={toggle}>Close related issues</button></div>,
  CenteredLoading: () => <div role="status">Loading</div>,
  CenteredError: ({ children }) => <div role="alert">{children}</div>,
  EmptyTip: () => <div>No related issues</div>,
}));
jest.mock('@/constants', () => ({ gettext: text => text, mediaUrl: '/' }));
jest.mock('@/project/api', () => ({
  connectionsAPI: { findRelatedRecords: jest.fn() },
  ticketsAPI: { findRelatedIssues: jest.fn() },
}));
jest.mock('@/project/components', () => {
  const React = require('react');
  const { useRelatedIssues } = require('@/project/hooks/related-issues');
  return { ResourceDetailsDialog: ({ resource, switchResource, onToggle }) => {
    const { openRelatedIssues } = useRelatedIssues();
    const [draft, setDraft] = React.useState('Original draft');
    return (
      <div data-testid="resource-details">
        <div data-testid="details">{resource.connection_id}:{resource._id}</div>
        <span>{draft}</span>
        <button onClick={() => setDraft('Edited draft')}>Edit details</button>
        <button onClick={() => openRelatedIssues({ row: resource, connection: { id: resource.connection_id } })}>Find related from details</button>
        {switchResource && <button onClick={() => switchResource(-1)}>Previous result</button>}
        {switchResource && <button onClick={() => switchResource(1)}>Next result</button>}
        <button onClick={onToggle}>Close details</button>
      </div>
    );
  } };
});
jest.mock('@/project/main-panel/connections/constants', () => ({ CONNECTION_TYPES: [] }));
jest.mock('@/project/main-panel/connections/components/related-issues-dialog/resolved-tag', () => () => <span>Resolved</span>);
jest.mock('@/project/utils', () => ({ getResourceIconURL: () => '/icon.png' }));
jest.mock('@/sea-metadata/utils/column', () => ({ formatWithTimezone: value => value }));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message } }));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const issue = (title, connectionId = 1) => ({
  _id: 'same-id', type: 'github', connection_id: connectionId, title,
  modified_time: '2026-11-26T00:00:00Z', content: 'Issue content',
});
const response = records => ({ data: { related_records: records } });

describe('Related issues workflow', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  let container;
  let root;
  let openRelatedIssues;

  const Consumer = () => {
    ({ openRelatedIssues } = useRelatedIssues());
    return null;
  };
  const renderProvider = (showConsumer = true) => act(() => {
    root.render(
      <RelatedIssuesProvider projectUuid="project">
        {showConsumer && <Consumer />}
      </RelatedIssuesProvider>
    );
  });
  const open = target => act(() => openRelatedIssues(target));
  const click = name => act(() => screen.getByRole('button', { name }).click());
  const finish = async (request, records) => act(async () => {
    request.resolve(response(records));
    await request.promise;
  });

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    connectionsAPI.findRelatedRecords.mockImplementation(() => new Promise(() => {}));
    ticketsAPI.findRelatedIssues.mockImplementation(() => new Promise(() => {}));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    renderProvider();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  });

  it('routes connection and ticket targets to their own APIs using canonical IDs', () => {
    open({ row: { _pk: 42, _id: 'legacy-id' }, connection: { id: 3 } });
    expect(connectionsAPI.findRelatedRecords).toHaveBeenCalledWith('project', 3, '42');
    expect(ticketsAPI.findRelatedIssues).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe('Loading');

    open({ row: { id: 7 } });
    expect(ticketsAPI.findRelatedIssues).toHaveBeenCalledWith('project', '7');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('keeps a target snapshot when the caller changes or unmounts', () => {
    const row = { _id: 'A' };
    const connection = { id: 1 };
    open({ row, connection });
    row._id = 'B';
    connection.id = 2;
    renderProvider(false);

    expect(connectionsAPI.findRelatedRecords.mock.calls).toEqual([['project', 1, 'A']]);
    expect(screen.getByRole('dialog')).not.toBeNull();
  });

  it('ignores invalid targets without replacing the current dialog', () => {
    open({ row: { _id: 'A' }, connection: { id: 1 } });
    open({ row: {} });
    open({ row: { _id: 'B' }, connection: {} });
    expect(connectionsAPI.findRelatedRecords).toHaveBeenCalledTimes(1);
    expect(ticketsAPI.findRelatedIssues).not.toHaveBeenCalled();
  });

  it.each(['connection', 'ticket'])('supports empty, error, and recovery states for %s', async source => {
    const api = source === 'connection' ? connectionsAPI.findRelatedRecords : ticketsAPI.findRelatedIssues;
    const target = { row: { _id: 'A' }, ...(source === 'connection' ? { connection: { id: 1 } } : {}) };
    const empty = deferred();
    api.mockReturnValueOnce(empty.promise);
    open(target);
    await finish(empty, null);
    expect(screen.getByText('No related issues')).not.toBeNull();

    const failure = deferred();
    api.mockReturnValueOnce(failure.promise);
    open(target);
    await act(async () => {
      failure.reject(new Error('Query failed'));
      await failure.promise.catch(() => {});
    });
    expect(screen.getByRole('alert').textContent).toBe('Query failed');

    const recovery = deferred();
    api.mockReturnValueOnce(recovery.promise);
    open(target);
    expect(screen.queryByRole('alert')).toBeNull();
    await finish(recovery, [issue('Recovered result')]);
    expect(screen.getByText('Recovered result')).not.toBeNull();
    expect(api).toHaveBeenCalledTimes(3);
  });

  it.each(['connection', 'ticket'])('preserves result navigation and resets details on reopen for %s', async source => {
    const api = source === 'connection' ? connectionsAPI.findRelatedRecords : ticketsAPI.findRelatedIssues;
    const request = deferred();
    api.mockReturnValueOnce(request.promise);
    const target = { row: { _id: 'A' }, ...(source === 'connection' ? { connection: { id: 1 } } : {}) };
    open(target);
    await finish(request, [issue('First result', 1), issue('Second result', 2)]);

    click('Close related issues');
    expect(screen.queryByRole('dialog')).toBeNull();
    const reopened = deferred();
    api.mockReturnValueOnce(reopened.promise);
    open(target);
    expect(screen.queryByText('First result')).toBeNull();
    await finish(reopened, [issue('First result', 1), issue('Second result', 2)]);
    act(() => screen.getByText('First result').click());
    expect(screen.getByTestId('details').textContent).toBe('1:same-id');
    click('Previous result');
    expect(screen.getByTestId('details').textContent).toBe('2:same-id');
    click('Next result');
    expect(screen.getByTestId('details').textContent).toBe('1:same-id');
    click('Close details');
    expect(screen.queryByTestId('details')).toBeNull();
    expect(screen.getByText('First result')).not.toBeNull();

    act(() => screen.getByText('Second result').click());
    open(target);
    expect(screen.queryByTestId('details')).toBeNull();
    expect(screen.queryByText('First result')).toBeNull();
    expect(screen.getByRole('status')).not.toBeNull();
    expect(api).toHaveBeenCalledTimes(3);
  });

  it.each(['resolve', 'reject'])('ignores a late %s after closing and opening another source', async outcome => {
    const old = deferred();
    const current = deferred();
    connectionsAPI.findRelatedRecords.mockReturnValueOnce(old.promise);
    ticketsAPI.findRelatedIssues.mockReturnValueOnce(current.promise);
    open({ row: { _id: 'A' }, connection: { id: 1 } });
    click('Close related issues');
    open({ row: { _id: 'B' } });
    await finish(current, [issue('Current result')]);

    await act(async () => {
      if (outcome === 'resolve') old.resolve(response([issue('Old result')]));
      else old.reject(new Error('Old error'));
      await old.promise.catch(() => {});
    });
    expect(screen.getByText('Current result')).not.toBeNull();
    expect(screen.queryByText('Old result')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('isolates the same row ID in different connections', async () => {
    const old = deferred();
    const current = deferred();
    connectionsAPI.findRelatedRecords.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    open({ row: { _id: 'A' }, connection: { id: 1 } });
    open({ row: { _id: 'A' }, connection: { id: 2 } });
    await finish(current, [issue('Connection 2 result')]);
    await finish(old, [issue('Connection 1 result')]);

    expect(screen.getByText('Connection 2 result')).not.toBeNull();
    expect(screen.queryByText('Connection 1 result')).toBeNull();
    expect(connectionsAPI.findRelatedRecords.mock.calls).toEqual([['project', 1, 'A'], ['project', 2, 'A']]);
  });

  it.each(['connection', 'ticket'])('ignores a stale request when %s dialog props change', async source => {
    const api = source === 'connection' ? connectionsAPI.findRelatedRecords : ticketsAPI.findRelatedIssues;
    const old = deferred();
    const current = deferred();
    api.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const renderDialog = id => act(() => root.render(source === 'connection'
      ? <ConnectionRelatedIssuesDialog projectUuid="project" connectionId={1} row={{ _id: id }} onClose={() => {}} />
      : <TicketRelatedIssuesDialog projectUuid="project" ticketId={id} onClose={() => {}} />));
    renderDialog('A');
    renderDialog('B');
    await finish(current, [issue('Current result')]);
    await finish(old, [issue('Old result')]);

    expect(screen.getByText('Current result')).not.toBeNull();
    expect(screen.queryByText('Old result')).toBeNull();
  });

  it.each(['ticket', 'connection'])('restores the %s results and selected record after closing a nested search', async source => {
    const original = deferred();
    const nested = deferred();
    const api = source === 'ticket' ? ticketsAPI.findRelatedIssues : connectionsAPI.findRelatedRecords;
    api.mockReturnValueOnce(original.promise);
    open({ row: { _id: 'A' }, ...(source === 'connection' ? { connection: { id: 1 } } : {}) });
    await finish(original, [issue('First result', 1), issue('Second result', 2)]);
    act(() => screen.getByText('Second result').click());
    click('Edit details');
    connectionsAPI.findRelatedRecords.mockReturnValueOnce(nested.promise);
    click('Find related from details');
    await finish(nested, [issue('Nested result', 3)]);
    act(() => screen.getByText('Nested result').click());
    expect(screen.getAllByTestId('details').map(node => node.textContent)).toEqual(['2:same-id', '3:same-id']);

    act(() => screen.getAllByRole('button', { name: 'Close related issues' }).slice(-1)[0].click());

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByText('First result')).not.toBeNull();
    expect(screen.getByText('Second result')).not.toBeNull();
    expect(screen.queryByText('Nested result')).toBeNull();
    expect(screen.getByTestId('details').textContent).toBe('2:same-id');
    expect(screen.getByText('Edited draft')).not.toBeNull();
    click('Next result');
    expect(screen.getByTestId('details').textContent).toBe('1:same-id');
    expect(ticketsAPI.findRelatedIssues).toHaveBeenCalledTimes(source === 'ticket' ? 1 : 0);
    expect(connectionsAPI.findRelatedRecords).toHaveBeenCalledTimes(source === 'connection' ? 2 : 1);
  });

  it('only closes the current search and ignores requests from a covered parent layer', async () => {
    const original = deferred();
    const nested = deferred();
    ticketsAPI.findRelatedIssues.mockReturnValueOnce(original.promise);
    connectionsAPI.findRelatedRecords.mockReturnValueOnce(nested.promise);
    open({ row: { _id: 'A' } });
    await finish(original, [issue('Original result', 1)]);
    act(() => screen.getByText('Original result').click());
    click('Find related from details');
    await finish(nested, [issue('Nested result', 2)]);

    act(() => screen.getAllByRole('button', { name: 'Close related issues' })[0].click());
    click('Find related from details');
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(connectionsAPI.findRelatedRecords).toHaveBeenCalledTimes(1);

    act(() => screen.getByText('Nested result').click());
    const deepest = deferred();
    connectionsAPI.findRelatedRecords.mockReturnValueOnce(deepest.promise);
    const details = screen.getAllByTestId('resource-details');
    act(() => within(details[1]).getByRole('button', { name: 'Find related from details' }).click());
    expect(screen.getAllByRole('dialog')).toHaveLength(3);
    act(() => screen.getAllByRole('button', { name: 'Close related issues' }).slice(-1)[0].click());
    await finish(deepest, [issue('Closed search result', 3)]);

    expect(screen.queryByText('Closed search result')).toBeNull();
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(screen.getAllByTestId('details').map(node => node.textContent)).toEqual(['1:same-id', '2:same-id']);
    act(() => screen.getAllByRole('button', { name: 'Close related issues' }).slice(-1)[0].click());
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByTestId('details').textContent).toBe('1:same-id');
    click('Close related issues');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByTestId('details')).toBeNull();
  });
});
