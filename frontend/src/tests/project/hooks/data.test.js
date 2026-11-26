import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DataProvider, useData } from '@/project/hooks/data';

jest.mock('@/api/user-api', () => ({}));
jest.mock('@/constants', () => ({ username: 'user@example.com' }));
jest.mock('@/components/common/notification/hooks/notification', () => ({ NotificationProvider: ({ children }) => children }));
jest.mock('@/sea-metadata', () => ({ CollaboratorsProvider: ({ children }) => children }));
jest.mock('@/sea-metadata/utils/row', () => ({ convertRowToKeyValue: row => row }));
jest.mock('@/project/api/project-api', () => ({}));
jest.mock('@/project/constants', () => ({ EMPTY_TABLE: jest.requireActual('@/project/constants/table').EMPTY_TABLE }));
jest.mock('@/project/main-panel/analyze/hooks/analyze-task', () => ({ AnalyzeTaskProvider: ({ children }) => children }));
jest.mock('@/project/main-panel/ask/hooks', () => ({ AIChatToolsProvider: ({ children }) => children }));
jest.mock('@/project/main-panel/connections/constants', () => ({ CONNECTION_PREDEFINED_COLUMN_NAME: {} }));
jest.mock('@/project/main-panel/connections/hooks', () => ({ ConnectionsProvider: ({ children }) => children }));
jest.mock('@/project/main-panel/connections/utils', () => ({}));
jest.mock('@/project/main-panel/knowledge-base/constants', () => ({}));
jest.mock('@/project/main-panel/portal-issues/hooks', () => ({ PortalIssuesMetadataProvider: ({ children }) => children }));
jest.mock('@/project/main-panel/tags/hooks/tags', () => ({ TagsProvider: ({ children }) => children }));
jest.mock('@/project/main-panel/tickets/hooks', () => ({
  MetadataProvider: ({ children }) => children,
  CloseLinkedIssuesProvider: ({ children }) => children,
}));
jest.mock('@/project/main-panel/tickets/constants', () => ({
  TICKET_TABLE_NAME: 'tickets',
  TICKET_STATE: { OPEN: 'open', CLOSED: 'closed' },
  PREDEFINED_TICKET_COLUMN_NAME: {},
  MY_TICKETS_VIEW_IDS: { assigned: {}, created: {} },
}));
jest.mock('@/project/utils', () => ({ shouldReload: () => false }));

const deferred = () => {
  let resolve;
  const promise = new Promise(res => { resolve = res; });
  return { promise, resolve };
};
const githubLinkUpdate = {
  tableName: 'tickets', rowId: 'A', rowUpdate: { links: ['2_7'] },
  linkedRecords: { '2_7': 'GitHub Issue' }, linkedGithubIssueStateMap: { '2_7': 'open' },
};
const listResponse = linked => ({ data: {
  tickets: [{ _pk: 'A', links: linked ? ['existing', '2_7'] : ['existing'] }],
  columns: [{ key: 'links', name: 'linked_connection_records' }],
  linked_records: linked ? { '2_7': 'GitHub Issue' } : {},
  linked_github_issue_state_map: linked ? { '2_7': 'open' } : {},
} });

describe('Project linked row cache updates', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  let root;
  let container;
  let dataAPI;

  const Consumer = () => {
    dataAPI = useData();
    return null;
  };

  beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
  afterAll(() => { global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment; });

  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
    act(() => { root.render(<DataProvider><Consumer /></DataProvider>); });
    act(() => { dataAPI.updateTable('tickets', {
      id_row_map: { A: { links: ['existing'] } },
      key_column_map: { links: { key: 'links', name: 'linked_connection_records' } },
      linked_records: {},
    }); });
  });

  afterEach(() => { act(() => root.unmount()); });

  it.each([[1, 2], [2, 1]])('merges batched insertions %j, %j against the latest cached row', (first, last) => {
    const insert = dataAPI.insertRowByLink;
    act(() => {
      [first, last].forEach(id => {
        const key = `2_${id}`;
        insert('tasks', 'tickets', { [key]: `Task ${id}` }, 'A', row => ({
          links: Array.from(new Set([...row.links, key])),
        }));
      });
    });

    const table = dataAPI.getTableByName('tickets');
    expect(table.id_row_map.A.links).toEqual(['existing', `2_${first}`, `2_${last}`]);
    expect(table.linked_records).toEqual({ '2_1': 'Task 1', '2_2': 'Task 2' });
  });

  it('continues accepting object updates', () => {
    act(() => { dataAPI.insertRowByLink('tasks', 'tickets', {}, 'A', { title: 'Updated title' }); });

    expect(dataAPI.getTableByName('tickets').id_row_map.A).toEqual({ links: ['existing'], title: 'Updated title' });
  });

  it.each([[1, 2], [2, 1]])('preserves reverse links and titles for request completion order %j, %j', async (first, last) => {
    const pending = {};
    const requests = [1, 2].map(id => {
      const key = `2_${id}`;
      return dataAPI.modifyRowLink({
        tableName: 'tickets', rowId: 'A',
        rowUpdate: Object.freeze({ links: [key] }), linkedRecords: { [key]: `Record ${id}` },
      }, {}, () => new Promise(resolve => { pending[id] = resolve; }));
    });
    for (const id of [first, last]) {
      await act(async () => { pending[id]({ data: {} }); await requests[id - 1]; });
    }
    await act(async () => {
      await dataAPI.modifyRowLink({
        tableName: 'tickets', rowId: 'A', rowUpdate: { links: ['2_1'] }, linkedRecords: { '2_1': 'Record 1' },
      }, {}, () => Promise.resolve({ data: {} }));
    });

    const table = dataAPI.getTableByName('tickets');
    expect(table.id_row_map.A.links).toEqual(['existing', `2_${first}`, `2_${last}`]);
    expect(table.linked_records).toEqual({ '2_1': 'Record 1', '2_2': 'Record 2' });
  });

  it('merges GitHub issue states into the shared cache and cached list responses', async () => {
    act(() => dataAPI.updateTable('tickets', { linked_github_issue_state_map: { existing: 'closed' } }));
    await act(async () => { await dataAPI.modifyRowLink(githubLinkUpdate, {}, () => Promise.resolve({ data: {} })); });
    expect(dataAPI.getTableByName('tickets').linked_github_issue_state_map).toEqual({ existing: 'closed', '2_7': 'open' });
    act(() => dataAPI.updateTable('tickets', { id_view_map: { all: { rows: ['A'], columns: ['links'], timestamp: Date.now(), has_more: false } } }));
    const load = jest.fn();
    const result = await dataAPI.getMetadata('tickets', { view_id: 'all', start: 0, limit: 20 }, load);

    expect(load).not.toHaveBeenCalled();
    expect(result.data.tickets[0].links).toEqual(['existing', '2_7']);
    expect(result.data.linked_github_issue_state_map).toEqual({ existing: 'closed', '2_7': 'open' });
  });

  it.each([
    ['custom view', false, true], ['built-in view', true, true], ['uncached view', false, false],
  ])('retries an older %s response before exposing it to the list or cache', async (_view, isBuiltIn, useCache) => {
    const old = deferred();
    const fresh = deferred();
    const load = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const params = { view_id: 'all', start: 0, limit: 20, is_reload: true, use_cache: useCache };
    const request = dataAPI.getMetadata('tickets', params, load, isBuiltIn);

    await act(async () => { await dataAPI.modifyRowLink(githubLinkUpdate, {}, () => Promise.resolve({ data: {} })); });
    await act(async () => { old.resolve(listResponse(false)); await old.promise; });
    expect(load).toHaveBeenCalledTimes(2);
    expect(dataAPI.getTableByName('tickets').id_row_map.A.links).toEqual(['existing', '2_7']);
    expect(dataAPI.getTableByName('tickets').linked_github_issue_state_map['2_7']).toBe('open');

    let result;
    await act(async () => { fresh.resolve(listResponse(true)); result = await request; });
    expect(result.data.tickets[0].links).toEqual(['existing', '2_7']);
    expect(result.data.linked_records['2_7']).toBe('GitHub Issue');
    expect(result.data.linked_github_issue_state_map['2_7']).toBe('open');
    expect(dataAPI.getTableByName('tickets').id_row_map.A.links).toEqual(['existing', '2_7']);

    // A later read can authoritatively remove a link; old additions are not replayed forever.
    await act(async () => {
      result = await dataAPI.getMetadata('tickets', params, () => Promise.resolve(listResponse(false)), isBuiltIn);
    });
    expect(result.data.tickets[0].links).toEqual(['existing']);
    if (useCache) expect(dataAPI.getTableByName('tickets').id_row_map.A.links).toEqual(['existing']);
  });

  it('keeps simultaneous older list requests from restoring stale links in either completion order', async () => {
    const reads = [deferred(), deferred()];
    const loaders = reads.map(read => jest.fn().mockReturnValueOnce(read.promise).mockImplementation(() => Promise.resolve(listResponse(true))));
    const requests = loaders.map((load, index) => dataAPI.getMetadata('tickets', { view_id: `view-${index}`, start: 0, limit: 20 }, load));
    await act(async () => { await dataAPI.modifyRowLink(githubLinkUpdate, {}, () => Promise.resolve({ data: {} })); });
    for (const index of [1, 0]) {
      let result;
      await act(async () => { reads[index].resolve(listResponse(false)); result = await requests[index]; });
      expect(result.data.tickets[0].links).toContain('2_7');
      expect(loaders[index]).toHaveBeenCalledTimes(2);
      expect(dataAPI.getTableByName('tickets').id_row_map.A.links).toContain('2_7');
    }
  });

  it('does not retry list requests after a failed link write or a write to other tables', async () => {
    const old = deferred();
    const load = jest.fn().mockReturnValue(old.promise);
    const request = dataAPI.getMetadata('tickets', { view_id: 'all', start: 0, limit: 20 }, load);
    await act(async () => {
      await expect(dataAPI.modifyRowLink(githubLinkUpdate, {}, () => Promise.reject(new Error('Failed')))).rejects.toThrow('Failed');
      await dataAPI.modifyRowLink({ ...githubLinkUpdate, tableName: 'notes' }, {}, () => Promise.resolve({ data: {} }));
    });
    await act(async () => { old.resolve(listResponse(false)); await request; });
    expect(load).toHaveBeenCalledTimes(1);
    expect(dataAPI.getTableByName('tickets').id_row_map.A.links).toEqual(['existing']);
  });
});
