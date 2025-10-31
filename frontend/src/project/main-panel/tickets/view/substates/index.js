import React, { useCallback, useEffect, useMemo } from 'react';
import { useSubstates, useTicketsPage } from '../../hooks';
import { CenteredLoading } from '@/components';
import { gettext } from '@/constants';
import SeaMetadata, { CellType, VIEW_TOOL } from '@/sea-metadata';
import context from '@/sea-metadata/context';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '@/project/constants/event-bus-type';
import SubstateDialog from './components/substate-dialog';

const AllSubstates = ({ projectUuid, permission }) => {
  const { isLoading, substatesData, createSubstate, modifySubstate, deleteSubstate, reload } = useSubstates();
  const { pageType, togglePageType } = useTicketsPage();

  const columns = useMemo(() => [
    {
      type: CellType.SINGLE_SELECT,
      key: 'name',
      name: 'name',
      display_name: gettext('Substate'),
      editable: false,
      is_name_column: true,
      frozen: true,
      click: (row) => togglePageType(pageType, row._id)
    },
    {
      type: CellType.NUMBER,
      key: 'tickets_count',
      name: 'tickets_count',
      display_name: gettext('Tickets count'),
      editable: false,
    },
  ], [pageType, togglePageType]);

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
      return new Promise((resolve) => {
        resolve({ data: {
          rows: substatesData.rows,
          columns: columns,
        } });
      });
    },

    // view
    getViews: () => new Promise((resolve) => resolve({ data: viewsData })),

    getView: (viewID) => new Promise((resolve) => {
      const view = viewsData.views[0];
      resolve({ data: { view: {
        ...view,
        sorts: context.localStorage.getItem('sorts') || [],
      } } });
    }),

    modifyView: (viewID, viewData) => new Promise((resolve) => {
      Object.keys(viewData).forEach(key => {
        context.localStorage.setItem(key, viewData[key]);
      });
      resolve({ data: { success: true } });
    }),

    // row
    insertRow: createSubstate,
    modifyRow: (...params) => modifySubstate(...params),
    deleteRow: (...params) => deleteSubstate(...params),

  }), [columns, viewsData, createSubstate, modifySubstate, deleteSubstate, substatesData]);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-substates`, [projectUuid]);

  const t = useMemo(() => ({
    row: gettext('substate'),
    rows: gettext('substates'),
    Rows: gettext('Substates'),
  }), []);

  useEffect(() => { reload(); }, []);

  useEffect(() => {
    const unsubscribeNew = eventBus.subscribe(EVENT_BUS_TYPE.NEW_SUBSTATE, () => {
      context.eventBus.dispatch('expand_row');
    });
    return () => {
      unsubscribeNew && unsubscribeNew();
    };
  }, []);

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
          label: gettext('Delete substates'),
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
      label: gettext('Edit substate'),
      callback: () => {
        context.eventBus.dispatch('expand_row', row);
      }
    }, {
      label: gettext('Delete substate'),
      callback: () => {
        deleteRows && deleteRows([row._id]);
      }
    });
    return list;
  }, []);

  if (isLoading) return (<CenteredLoading />);

  return (
    <>
      <SeaMetadata
        viewID="0000"
        className="sea-substates-metadata"
        api={api}
        permission={permission}
        localStorageNamePrefix={localStorageName}
        viewTools={[VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.VIEWS, VIEW_TOOL.SEARCH, VIEW_TOOL.SORTS]}
        isViewComputedOnServer={false}
        createContextMenuOptions={createContextMenuOptions}
        t={t}
      >
        <SubstateDialog />
      </SeaMetadata>
    </>
  );
};

export default AllSubstates;
