import { EVENT_BUS_TYPE, PER_LOAD_NUMBER } from '@/sea-metadata/constants';
import context from '@/sea-metadata/context';
import Store from '@/sea-metadata/store';

jest.mock('@/sea-metadata/context', () => ({
  canDeleteRow: jest.fn(),
  getMetadata: jest.fn(),
  getSetting: jest.fn(),
  eventBus: { dispatch: jest.fn() },
}));
jest.mock('@/sea-metadata/constants', () => ({
  PER_LOAD_NUMBER: 1000,
  EVENT_BUS_TYPE: {
    RELOAD_DATA: 'reload_data',
    RECALCULATE_DATA: 'recalculate_data',
    LOCAL_DATA_CHANGED: 'local_data_changed',
    RE_SEARCH_ROWS: 're_search_rows',
  },
}));
jest.mock('@/sea-metadata/models', () => ({
  Row: jest.requireActual('@/sea-metadata/models/row').default,
}));
jest.mock('@/sea-metadata/utils/column', () => ({}));
jest.mock('@/sea-metadata/utils/row', () => ({ getRowById: (data, id) => data.id_row_map[id] }));
jest.mock('@/sea-metadata/store/data-processor', () => ({}));
jest.mock('@/sea-metadata/store/local-operator', () => jest.fn());
jest.mock('@/sea-metadata/store/server-operator', () => jest.fn());
jest.mock('@/sea-metadata/store/operations', () => ({
  OPERATION_TYPE: {
    DELETE_ROW: 'delete_row',
    MODIFY_FILTERS: 'modify_filters',
    MODIFY_SORTS: 'modify_sorts',
    MODIFY_GROUPBYS: 'modify_groupbys',
  },
}));

describe('Deleting a row from a detail dialog', () => {
  let store;
  const loadedRow = { _id: '7', title: 'Loaded ticket', creator: 'owner' };

  beforeEach(() => {
    jest.clearAllMocks();
    context.canDeleteRow.mockReturnValue(true);
    store = new Store({});
    store.data = { id_row_map: {} };
    store.createOperation = jest.fn(operation => operation);
    store.applyOperation = jest.fn();
  });

  it('deletes an absent row using the dialog snapshot and preserves it for undo', () => {
    store.deleteRow('7', { row_data: loadedRow });

    expect(context.canDeleteRow).toHaveBeenCalledWith(loadedRow);
    expect(store.applyOperation).toHaveBeenCalledWith(expect.objectContaining({
      type: 'delete_row', row_id: '7', row_data: loadedRow,
    }));
    expect(store.data.id_row_map).toEqual({});
  });

  it('prefers the current list row for permission checks and undo', () => {
    const currentRow = { ...loadedRow, title: 'Updated ticket' };
    store.data.id_row_map['7'] = currentRow;

    store.deleteRow('7', { row_data: loadedRow });

    expect(context.canDeleteRow).toHaveBeenCalledWith(currentRow);
    expect(store.applyOperation).toHaveBeenCalledWith(expect.objectContaining({ row_data: currentRow }));
  });

  it('does not bypass permissions for an absent row', () => {
    context.canDeleteRow.mockReturnValue(false);

    store.deleteRow('7', { row_data: loadedRow });

    expect(store.applyOperation).not.toHaveBeenCalled();
  });

  it('rejects missing snapshots and snapshots of a different row', () => {
    store.deleteRow('7', {});
    store.deleteRow('8', { row_data: loadedRow });

    expect(store.applyOperation).not.toHaveBeenCalled();
    expect(context.canDeleteRow).not.toHaveBeenCalled();
  });
});

describe.each([
  ['filters', store => store.modifyFilters('And', [{}]), true],
  ['sorts', store => store.modifySorts([{}]), true],
  ['groupbys', store => store.modifyGroupbys([{}]), false],
])('Changing local %s', (name, modifyView, alwaysRecalculate) => {
  test.each([
    [true, true],
    [true, false],
    [false, true],
  ])('uses local recalculation with load-all=%s and more pages=%s', (loadAll, hasMore) => {
    jest.clearAllMocks();
    context.getSetting.mockImplementation(setting => setting === 'loadAllRowsOnViewChange' && loadAll);
    const store = new Store({});
    store.data = { hasMore, view: { [name]: [{}] } };
    store.createOperation = operation => operation;
    store.applyOperation = operation => operation.success_callback();

    modifyView(store);

    if (alwaysRecalculate || (loadAll && hasMore)) {
      expect(context.eventBus.dispatch).toHaveBeenCalledTimes(1);
      expect(context.eventBus.dispatch).toHaveBeenCalledWith(EVENT_BUS_TYPE.RECALCULATE_DATA);
    } else {
      expect(context.eventBus.dispatch).not.toHaveBeenCalled();
    }
  });
});

describe('Loading remaining rows for a local view', () => {
  const firstRow = { _id: '12:1', processing_status: 'processed' };
  const page = (id, hasMore) => ({ data: { rows: [{ _pk: id }], has_more: hasMore } });
  let store;

  beforeEach(() => {
    context.getMetadata.mockReset();
    context.getSetting.mockImplementation(name => name === 'loadAllRowsOnViewChange');
    store = new Store({ viewId: 'all' });
    store.startIndex = 1;
    store.data = {
      hasMore: true,
      rows: [firstRow],
      row_ids: [firstRow._id],
      id_row_map: { [firstRow._id]: firstRow },
      view: {},
    };
    store.recalculate = jest.fn();
  });

  test.each(['filters', 'basic_filters', 'sorts', 'groupbys'])('appends only missing pages when %s is set', async option => {
    store.data.view[option] = [{}];
    context.getMetadata.mockResolvedValueOnce(page('12:2', true)).mockResolvedValueOnce(page('12:3', false));

    await store.recalculateView();

    expect(context.getMetadata.mock.calls).toEqual([
      [{ view_id: 'all', start: 1, limit: PER_LOAD_NUMBER }],
      [{ view_id: 'all', start: 2, limit: PER_LOAD_NUMBER }],
    ]);
    expect(store.data.row_ids).toEqual(['12:1', '12:2', '12:3']);
    expect(store.data.rows[0]).toBe(firstRow);
    expect(store.data.hasMore).toBe(false);
    expect(store.recalculate).toHaveBeenCalledTimes(1);
  });

  test.each(['filters', 'sorts', 'groupbys'])('keeps available rows and retries the failed page when %s is set', async option => {
    store.data.view[option] = [{}];
    context.getMetadata
      .mockResolvedValueOnce(page('12:2', true))
      .mockRejectedValueOnce(new Error('Page timed out'))
      .mockResolvedValueOnce(page('12:3', false));

    await store.recalculateView();

    expect(store.data.row_ids).toEqual(['12:1', '12:2']);
    expect(store.data.hasMore).toBe(true);
    expect(store.data.hasIncompleteResults).toBe(true);
    expect(store.recalculate).toHaveBeenCalledTimes(1);

    await store.recalculateView();

    expect(context.getMetadata.mock.calls.map(([params]) => params.start)).toEqual([1, 2, 2]);
    expect(store.data.row_ids).toEqual(['12:1', '12:2', '12:3']);
    expect(store.data.hasIncompleteResults).toBe(false);
    expect(store.recalculate).toHaveBeenCalledTimes(2);
  });

  test('publishes a complete view when regular pagination reaches the end', async () => {
    store.data.view.sorts = [{}];
    store.data.hasIncompleteResults = true;
    const previousData = store.data;
    context.getMetadata.mockResolvedValueOnce(page('12:2', false));

    await store.loadMore(PER_LOAD_NUMBER);

    expect(store.data).not.toBe(previousData);
    expect(store.data.hasIncompleteResults).toBe(false);
    expect(context.eventBus.dispatch).toHaveBeenCalledWith(EVENT_BUS_TYPE.LOCAL_DATA_CHANGED);
  });

  test.each([false, true])('preserves incomplete=%s when a superseded page fails', async hasIncompleteResults => {
    store.data.view.groupbys = [{}];
    let rejectPage;
    context.getMetadata.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectPage = reject; }));
    const pending = store.recalculateView();

    store.initStartIndex();
    store.data = { ...store.data, hasIncompleteResults };
    rejectPage(new Error('Superseded page timed out'));
    await pending;

    expect(store.data.hasIncompleteResults).toBe(hasIncompleteResults);
  });

  test('does not fetch more rows when there are no active view options', async () => {
    await store.recalculateView();

    expect(context.getMetadata).not.toHaveBeenCalled();
    expect(store.data.hasMore).toBe(true);
    expect(store.recalculate).toHaveBeenCalledTimes(1);
  });

  test('does not fetch more rows unless the table opted in', async () => {
    store.data.view.sorts = [{}];
    context.getSetting.mockReturnValue(false);

    await store.recalculateView();

    expect(context.getMetadata).not.toHaveBeenCalled();
  });

  test('shares a page request already started by normal scrolling', async () => {
    store.data.view.groupbys = [{}];
    context.getMetadata.mockResolvedValueOnce(page('12:2', true)).mockResolvedValueOnce(page('12:3', false));

    await Promise.all([store.loadMore(PER_LOAD_NUMBER), store.recalculateView()]);

    expect(context.getMetadata.mock.calls.map(([params]) => params.start)).toEqual([1, 2]);
    expect(store.data.row_ids).toEqual(['12:1', '12:2', '12:3']);
  });
});
