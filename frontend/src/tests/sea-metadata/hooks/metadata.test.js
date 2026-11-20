import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import context from '@/sea-metadata/context';
import { MetadataProvider } from '@/sea-metadata/hooks/metadata';

let mockStore;
jest.mock('@/components/toaster', () => ({}));
jest.mock('@/utils/hotkey', () => ({}));
jest.mock('@/utils/utils', () => ({}));
jest.mock('@/sea-metadata/constants', () => ({ EVENT_BUS_TYPE: new Proxy({}, { get: (_target, key) => key }) }));
jest.mock('@/sea-metadata/context', () => ({
  re_set: jest.fn(),
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
});

describe('Local metadata row events', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  let root;

  beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
  afterAll(() => { global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment; });

  beforeEach(async () => {
    root = createRoot(document.createElement('div'));
    await act(async () => { root.render(<MetadataProvider />); });
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
});
