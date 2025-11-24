import React, { useCallback, useEffect, useMemo } from 'react';
import { useTags, useTicketsPage } from '../../hooks';
import { CenteredLoading } from '@/components';
import { gettext } from '@/constants';
import TagDialog from './components/tag-dialog';
import SeaMetadata, { CellType, VIEW_TOOL } from '@/sea-metadata';
import context from '@/sea-metadata/context';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '../../../../constants';

const AllTags = ({ projectUuid, permission }) => {
  const { isLoading, tagsData, createTag, modifyTag, deleteTag, deleteTags, reload } = useTags();
  const { pageSlugId, togglePageSlugId } = useTicketsPage();

  const columns = useMemo(() => [
    {
      type: CellType.TAG,
      key: 'name',
      name: 'name',
      display_name: gettext('Tag'),
      editable: false,
      is_name_column: true,
      frozen: true,
      click: (row) => togglePageSlugId(pageSlugId, row._id)
    },
    {
      type: CellType.TEXT,
      key: 'description',
      name: 'description',
      display_name: gettext('Description'),
      editable: true,
      is_required: false,
    },
    {
      type: CellType.NUMBER,
      key: 'tickets_count',
      name: 'tickets_count',
      display_name: gettext('Tickets count'),
      editable: false,
    },
  ], [pageSlugId, togglePageSlugId]);

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

      if (context.canDeleteRow()) {
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
            rows: rows,
            callback: (event, { rows }) => {
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

      if (context.canDeleteRow() && rows.length > 0) {
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
    list.push({
      label: gettext('Edit tag'),
      callback: () => {
        context.eventBus.dispatch('expand_row', row);
      }
    });

    if (context.canDeleteRow()) {
      list.push({
        label: gettext('Delete tag'),
        callback: () => deleteRows && deleteRows([row._id])
      });
    }
    return list;
  }, []);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-tags`, [projectUuid]);

  const t = useMemo(() => {
    return {
      row: gettext('tag'),
      rows: gettext('tags'),
      Row: gettext('Tag'),
      Rows: gettext('Tags'),
    };
  }, []);

  useEffect(() => {
    reload();
  }, []);

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
    <>
      <SeaMetadata
        viewID="0000"
        className="sea-tags-metadata"
        fixedColumnCount={2}
        api={api}
        localStorageNamePrefix={localStorageName}
        permission={permission}
        createContextMenuOptions={createContextMenuOptions}
        viewTools={[VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.VIEWS, VIEW_TOOL.SEARCH, VIEW_TOOL.SORTS]}
        isViewComputedOnServer={false}
        t={t}
      >
        <TagDialog />
      </SeaMetadata>
    </>
  );

};

export default AllTags;
