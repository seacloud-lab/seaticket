import Store from '@/sea-metadata/store';

const context = { canDeleteRow: jest.fn() };
jest.mock('@/sea-metadata/constants', () => ({}));
jest.mock('@/sea-metadata/models', () => ({}));
jest.mock('@/sea-metadata/utils/column', () => ({}));
jest.mock('@/sea-metadata/utils/row', () => ({ getRowById: (data, id) => data.id_row_map[id] }));
jest.mock('@/sea-metadata/store/data-processor', () => jest.fn());
jest.mock('@/sea-metadata/store/local-operator', () => jest.fn());
jest.mock('@/sea-metadata/store/server-operator', () => jest.fn());
jest.mock('@/sea-metadata/store/operations', () => ({ OPERATION_TYPE: { DELETE_ROW: 'delete_row' } }));

describe('Deleting a row from a detail dialog', () => {
  let store;
  const loadedRow = { _id: '7', title: 'Loaded ticket', creator: 'owner' };

  beforeEach(() => {
    jest.clearAllMocks();
    context.canDeleteRow.mockReturnValue(true);
    store = new Store({ context });
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
