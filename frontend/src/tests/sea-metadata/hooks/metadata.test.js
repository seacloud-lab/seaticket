import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import toaster from '@/components/toaster';
import { EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import context from '@/sea-metadata/context';
import { MetadataProvider } from '@/sea-metadata/hooks/metadata';

let mockStore;
jest.mock('@/components/toaster', () => ({ success: jest.fn(), danger: jest.fn() }));
jest.mock('@/utils/hotkey', () => ({}));
jest.mock('@/utils/utils', () => ({}));
jest.mock('@/sea-metadata/constants', () => ({ EVENT_BUS_TYPE: new Proxy({}, { get: (_target, key) => key }) }));
jest.mock('@/sea-metadata/context', () => ({
  re_set: jest.fn(),
  translate: text => text,
  eventBus: jest.requireActual('@/utils/event-bus').default,
}));
jest.mock('@/sea-metadata/utils/row', () => ({ getRowById: (data, id) => data.id_row_map[id] }));
jest.mock('@/sea-metadata/hooks/collaborators', () => ({ useCollaborators: () => ({ collaborators: [], collaboratorsCache: {} }) }));
jest.mock('@/sea-metadata/hooks/selected-rows', () => ({ useSelectedRows: () => ({ selectedRowIds: [] }) }));
jest.mock('@/sea-metadata/store', () => class {
  constructor() {
    this.data = { id_row_map: { A: { links: ['existing'] } } };
    mockStore = this;
  }
  initStartIndex() {}
  load() { return Promise.resolve(); }
  destroy() {}
  modifyLocalRow(id, update) {
    this.data.id_row_map[id] = { ...this.data.id_row_map[id], ...update };
  }
  modifyRow(id, update, _oldData, _isCopyPaste, callbacks) {
    this.modifyLocalRow(id, update);
    this.lastSuccessCallback = callbacks.success_callback;
    callbacks.success_callback();
  }
});

describe('Local metadata row events', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  let root;
  let metadataRef;
  let createContextMenuOptions;

  beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
  afterAll(() => { global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment; });

  beforeEach(async () => {
    metadataRef = React.createRef();
    createContextMenuOptions = jest.fn();
    root = createRoot(document.createElement('div'));
    await act(async () => { root.render(<MetadataProvider ref={metadataRef} createContextMenuOptions={createContextMenuOptions} />); });
  });
  afterEach(() => { act(() => root.unmount()); });

  it.each([[1, 2], [2, 1]])('merges insertions %j, %j against the latest list row', (first, last) => {
    act(() => {
      [first, last].forEach(id => {
        context.eventBus.dispatch(EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, 'A', row => ({
          links: Array.from(new Set([...row.links, `2_${id}`])),
        }));
      });
    });

    expect(mockStore.data.id_row_map.A.links).toEqual(['existing', `2_${first}`, `2_${last}`]);
  });

  it('continues accepting object updates', () => {
    act(() => { context.eventBus.dispatch(EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, 'A', { title: 'Updated title' }); });

    expect(mockStore.data.id_row_map.A).toEqual({ links: ['existing'], title: 'Updated title' });
  });

  it('notifies the dialog only for the initial menu operation when Store reuses callbacks for undo and redo', () => {
    const onRowChange = jest.fn();
    const successCallback = jest.fn();
    mockStore.modifyLocalRow('A', { title: 'Original' });
    createContextMenuOptions.mockImplementation(({ modifyRow }) => [{
      callback: () => modifyRow('A', { title: 'Edited' }, { title: 'Original' }, false, { success_callback: successCallback }),
    }]);
    const options = metadataRef.current.createMoreOptions({ _id: 'A' }, { onRowChange });

    act(() => options[0].callback());

    expect(onRowChange).toHaveBeenCalledTimes(1);
    expect(onRowChange).toHaveBeenLastCalledWith(expect.objectContaining({ rowUpdate: { title: 'Edited' } }));
    for (const title of ['Original', 'Edited']) {
      act(() => {
        mockStore.modifyLocalRow('A', { title });
        mockStore.lastSuccessCallback();
      });
      expect(onRowChange).toHaveBeenCalledTimes(1);
    }
    expect(successCallback).toHaveBeenCalledTimes(3);
  });

  it('supplies the loaded row when a dialog deletes a record removed from the list', () => {
    const row = { _id: 'A', title: 'Loaded ticket', assignees: [] };
    const onRowChange = jest.fn();
    const successCallback = jest.fn();
    mockStore.deleteRow = jest.fn((_id, callbacks) => callbacks.success_callback());
    createContextMenuOptions.mockImplementation(({ deleteRow }) => [{
      callback: () => deleteRow('A', { success_callback: successCallback }),
    }]);
    const options = metadataRef.current.createMoreOptions(row, { onRowChange });
    delete mockStore.data.id_row_map.A;

    act(() => options[0].callback());

    expect(mockStore.deleteRow).toHaveBeenCalledWith('A', expect.objectContaining({ row_data: row }));
    expect(onRowChange).toHaveBeenCalledTimes(1);
    expect(onRowChange).toHaveBeenCalledWith(expect.objectContaining({ deleted: true }));
    expect(successCallback).toHaveBeenCalledTimes(1);
  });

  it('does not close the dialog when deleting a detached row fails', () => {
    const onRowChange = jest.fn();
    const failCallback = jest.fn();
    mockStore.deleteRow = jest.fn((_id, callbacks) => callbacks.fail_callback('Delete failed'));
    createContextMenuOptions.mockImplementation(({ deleteRow }) => [{
      callback: () => deleteRow('A', { fail_callback: failCallback }),
    }]);
    const options = metadataRef.current.createMoreOptions({ _id: 'A' }, { onRowChange });
    delete mockStore.data.id_row_map.A;

    act(() => options[0].callback());

    expect(onRowChange).not.toHaveBeenCalled();
    expect(failCallback).toHaveBeenCalledWith('Delete failed');
    expect(toaster.danger).toHaveBeenCalledWith('Delete failed');
  });
});
