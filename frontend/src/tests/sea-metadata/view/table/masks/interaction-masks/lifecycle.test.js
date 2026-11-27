import { CellType, EVENT_BUS_TYPE, TRANSFER_TYPES } from '@/sea-metadata/constants';
import { createMetadataContext } from '@/sea-metadata/context';
import InteractionMasks from '@/sea-metadata/view/table/masks/interaction-masks';
import { EventBus } from '@/utils/event-bus';

jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/components/toaster', () => ({ success: jest.fn() }));
jest.mock('@/sea-metadata/context-provider', () => ({ withSeaMetadataContext: Component => Component }));
jest.mock('@/sea-metadata/view/table/editors/editor-container', () => () => null);
jest.mock('@/sea-metadata/view/table/editors/editor-portal', () => () => null);

it('stops selection and drag callbacks when an interaction layer unmounts while its table remains', () => {
  const eventBus = new EventBus();
  const masks = new InteractionMasks({ metadataContext: { eventBus, canModifyRows: () => false } });
  masks.selectNone = jest.fn();
  masks.handleDragEnter = jest.fn();
  masks.componentDidMount();
  masks.componentWillUnmount();

  eventBus.dispatch(EVENT_BUS_TYPE.SELECT_NONE);
  eventBus.dispatch(EVENT_BUS_TYPE.DRAG_ENTER);

  expect(masks.selectNone).not.toHaveBeenCalled();
  expect(masks.handleDragEnter).not.toHaveBeenCalled();
});

it.each([
  [EVENT_BUS_TYPE.PASTE_CELLS, 'r', 'rw', true],
  [EVENT_BUS_TYPE.PASTE_CELLS, 'rw', 'r', false],
  [EVENT_BUS_TYPE.CUT_CELLS, 'r', 'rw', true],
  [EVENT_BUS_TYPE.CUT_CELLS, 'rw', 'r', false],
])('uses current permissions for %s after changing from %s to %s', (type, initialPermission, permission, allowed) => {
  const context = createMetadataContext();
  const api = { modifyRow: jest.fn() };
  context.configure({ permission: initialPermission, api });
  const columns = [{ key: 'title', type: CellType.TEXT, editable: true }];
  const row = { _id: 'row', title: 'Original title' };
  const paste = jest.fn();
  const masks = new InteractionMasks({
    metadataContext: context,
    columns,
    paste,
    rowGetterByIndex: () => row,
    getCopiedRowsAndColumnsFromRange: () => ({ copiedRows: [row], copiedColumns: columns }),
  });
  const position = { idx: 0, rowIdx: 0 };
  masks.state = { ...masks.state, selectedPosition: position, selectedRange: { topLeft: position, bottomRight: position } };
  const cell = document.createElement('div');
  cell.tabIndex = 0;
  cell.setAttribute('data-test', 'cell-mask');
  document.body.appendChild(cell);
  cell.focus();
  const clipboardData = {
    types: [TRANSFER_TYPES.TEXT],
    getData: format => format === TRANSFER_TYPES.TEXT ? 'Pasted title' : '',
    setData: jest.fn(),
  };
  masks.componentDidMount();
  try {
    context.configure({ permission, api });
    context.eventBus.dispatch(type, { target: cell, clipboardData, preventDefault: jest.fn() });

    if (type === EVENT_BUS_TYPE.PASTE_CELLS) {
      expect(paste).toHaveBeenCalledTimes(allowed ? 1 : 0);
      if (allowed) expect(paste.mock.calls[0][0].copied.copiedRows).toEqual([{ col0: 'Pasted title' }]);
    } else {
      expect(clipboardData.setData).toHaveBeenCalledTimes(allowed ? 2 : 0);
      if (allowed) expect(clipboardData.setData).toHaveBeenCalledWith(TRANSFER_TYPES.TEXT, row.title);
    }
  } finally {
    masks.componentWillUnmount();
    context.destroy();
    cell.remove();
  }
});
