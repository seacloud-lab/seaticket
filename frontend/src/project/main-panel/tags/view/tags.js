import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CenteredLoading } from '@/components';
import { gettext } from '@/constants';
import OptionDialog from '@/project/components/option-dialog';
import SeaMetadata, { CellType, VIEW_TOOL } from '@/sea-metadata';
import context from '@/sea-metadata/context';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '@/project/constants';
import { getRowById } from '@/sea-metadata/utils/row';
import { useTags } from '@/project/hooks';

const Tags = ({ projectUuid, permission }) => {
  const [isLoading, setIsLoading] = useState(true);
  const { tagsData, createTag, modifyTag, deleteTag, deleteTags, loadTags } = useTags();

  const columns = useMemo(() => [
    {
      type: CellType.TAG,
      key: 'name',
      name: 'name',
      display_name: gettext('Tag'),
      editable: false,
      is_name_column: true,
      frozen: true,
    }, {
      type: CellType.TEXT,
      key: 'description',
      name: 'description',
      display_name: gettext('Description'),
      editable: true,
      is_required: false,
    }
  ], []);

  const viewsData = useMemo(() => ({
    navigation: [{ _id: '0000', type: 'view' }],
    views: [
      {
        _id: '0000',
        name: gettext('All'),
      }
    ]
  }), []);

  const api = useMemo(() => ({
    getMetadata: (...params) => {
      return new Promise((resolve, reject) => {
        resolve({ data: {
          rows: tagsData.rows,
          columns: columns,
        } });
      });
    },

    // view
    getViews: () => {
      return new Promise((resolve, reject) => {
        resolve({ data: viewsData });
      });
    },

    getView: (viewID) => {
      return new Promise((resolve, reject) => {
        const view = viewsData.views[0];

        resolve({ data: { view: {
          ...view,
          sorts: context.localStorage.getItem('sorts') || [],
        } } });
      });
    },

    modifyView: (viewID, viewData) => {
      return new Promise((resolve, reject) => {
        Object.keys(viewData).forEach(key => {
          context.localStorage.setItem(key, viewData[key]);
        });
        resolve({ data: { success: true } });
      });
    },

    // row
    insertRow: createTag,
    modifyRow: (...params) => modifyTag(...params),
    deleteRow: (...params) => deleteTag(...params),
    deleteRows: (...params) => deleteTags(...params),

  }), [projectUuid, columns, viewsData, createTag, tagsData]);

  const createContextMenuOptions = useCallback(({
    isGroupView,
    selectedRange,
    selectedPosition,
    position,
    table,
    rowMetrics,
    deleteRow,
    deleteRows,
    hideMenu,
    onClearSelected,
    onCopySelected,
    rowGetterByIndex,
    selectNone,
    context,
  }) => {
    let list = [];

    // handle selected multiple cells
    if (selectedRange) {
      if (context.canModify()) {
        list.push({
          label: gettext('Clear selected'),
          callback: onClearSelected,
        });
      }
      list.push({
        label: gettext('Copy selected'),
        callback: onCopySelected,
      });

      if (context.canDeleteRows()) {
        const { topLeft, bottomRight } = selectedRange;
        let rows = [];
        for (let i = topLeft.rowIdx; i <= bottomRight.rowIdx; i++) {
          const row = rowGetterByIndex({ isGroupView, groupRowIndex: topLeft.groupRowIndex, rowIndex: i });
          if (row) {
            rows.push(row);
          }
        }
        if (rows.length > 0) {
          list.push({
            label: gettext('Delete selected'),
            callback: (event) => {
              const rowIds = rows.map(row => row._id);
              deleteRows && deleteRows(rowIds);
            }
          });
        }
      }
      return list;
    }

    // handle selected rows
    const selectedRowIds = rowMetrics ? Object.keys(rowMetrics.idSelectedRowMap) : [];
    if (selectedRowIds.length > 1) {
      let rows = [];
      selectedRowIds.forEach(id => {
        const row = table.id_row_map[id];
        if (row) {
          rows.push(row);
        }
      });

      if (context.canDeleteRows() && rows.length > 0) {
        list.push({
          label: gettext('Delete tags'),
          callback: (event) => {
            const rowIds = rows.map(row => row._id);
            deleteRows && deleteRows(rowIds);
          }
        });
      }
      return list;
    }

    // handle selected cell
    if (!selectedPosition) return list;
    const { groupRowIndex, rowIdx: rowIndex } = selectedPosition;
    const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex }) || table.id_row_map[selectedRowIds[0]];
    if (!row) return list;
    if (context.canModifyRow(row)) {
      list.push({
        label: gettext('Edit tag'),
        callback: () => {
          context.eventBus.dispatch('expand_row', row);
        }
      });
    }

    if (context.canDeleteRow()) {
      list.push({
        label: gettext('Delete tag'),
        callback: () => deleteRow && deleteRow(row._id)
      });
    }
    return list;
  }, []);

  const localStorageName = useMemo(() => `seaqa-${projectUuid}-tags`, [projectUuid]);

  const t = useMemo(() => {
    return {
      row: gettext('tag'),
      rows: gettext('tags'),
      Row: gettext('Tag'),
      Rows: gettext('Tags'),
    };
  }, []);

  const cascadeUpdateCells = useCallback((table, rowId, rowUpdate, oldRowData) => {
    const row = getRowById(table, rowId);
    if (!row || !rowUpdate) return;
    const updatedColumnKeys = Object.keys(rowUpdate);
    updatedColumnKeys.forEach(key => {
      if (key === 'description') {
        rowUpdate[key] = rowUpdate[key] || '';
      }
    });
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    loadTags(() => setIsLoading(false));
  }, [isLoading, loadTags]);

  useEffect(() => {
    const unsubscribeNewTag = eventBus.subscribe(EVENT_BUS_TYPE.NEW_TAG, () => {
      context.eventBus.dispatch('expand_row');
    });
    return () => {
      unsubscribeNewTag();
    };
  }, []);

  if (isLoading) return (<CenteredLoading />);

  return (
    <SeaMetadata
      className="sea-tags-metadata"
      fixedColumnCount={2}
      api={api}
      isShowViewInURL={false}
      localStorageNamePrefix={localStorageName}
      permission={permission}
      createContextMenuOptions={createContextMenuOptions}
      viewTools={[VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.VIEWS, VIEW_TOOL.SEARCH, VIEW_TOOL.SORTS]}
      settings={{ isFilterComputedOnServer: false, isSortComputedOnServer: false }}
      t={t}
      cascadeUpdateCells={cascadeUpdateCells}
    >
      <OptionDialog type={gettext('tag')} />
    </SeaMetadata>
  );

};

export default Tags;
