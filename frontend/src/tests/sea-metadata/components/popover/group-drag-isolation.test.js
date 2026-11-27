import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import GroupbyItem from '@/sea-metadata/components/popover/groupbys-popover/groupbys/groupby-item';
import { createMetadataContext } from '@/sea-metadata/context';
import { SeaMetadataContextProvider } from '@/sea-metadata/context-provider';

const mockSources = [];
const mockTargets = [];
// Keep the DnD connector boundary small; match source/target types exactly as
// the shared HTML5 backend does, then invoke the registered drop handler.
jest.mock('react-dnd', () => ({
  useDrag: spec => {
    mockSources.push(spec);
    return [{}, ref => ref, ref => ref];
  },
  useDrop: spec => {
    mockTargets.push(spec);
    return [{ isOver: false, canDrop: false }, ref => ref];
  },
}));
jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/components', () => ({ Icon: () => null }));
jest.mock('@/sea-metadata/components/selectors', () => ({ ColumnSelector: () => null, SortSelector: () => null }));
jest.mock('@/sea-metadata/components/selectors/scoped-select', () => () => null);

it('does not move grouping rules between metadata instances sharing a DnD manager', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const contexts = ['main', 'dialog'].map(id => Object.assign(createMetadataContext(), { id }));
  const move = [jest.fn(), jest.fn()];
  const columns = [{ key: 'a', type: 'text' }, { key: 'b', type: 'text' }];
  const drop = (source, target) => {
    if ([].concat(target.accept).includes(source.type)) target.drop(source.item());
  };
  mockSources.length = 0;
  mockTargets.length = 0;

  try {
    act(() => root.render(contexts.map((context, tableIndex) => (
      <SeaMetadataContextProvider key={context.id} context={context}>
        {columns.map((column, index) => (
          <GroupbyItem key={column.key} index={index} showDragBtn groupby={{ column_key: column.key }} columns={columns} onMove={move[tableIndex]} />
        ))}
      </SeaMetadataContextProvider>
    ))));
    drop(mockSources[0], mockTargets[3]);
    expect(move[1]).not.toHaveBeenCalled();
    drop(mockSources[0], mockTargets[1]);
    expect(move[0]).toHaveBeenCalledTimes(1);
    expect(move[0]).toHaveBeenCalledWith({ idx: 0, data: { column_key: 'a' } }, { idx: 1, data: { column_key: 'b' } });
  } finally {
    act(() => root.unmount());
    contexts.forEach(context => context.destroy());
    container.remove();
    global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  }
});
