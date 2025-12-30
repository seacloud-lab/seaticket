import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMetadata, useTicketsPage } from '../../hooks';
import { CenteredLoading } from '@/components';
import { gettext } from '@/constants';
import SeaMetadata, { CellType, VIEW_TOOL } from '@/sea-metadata';
import context from '@/sea-metadata/context';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '@/project/constants/event-bus-type';
import OptionDialog from '../../components/option-dialog';
import { getRowById } from '@/sea-metadata/utils/row';

const AllSubstates = ({ projectUuid, permission }) => {
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: isMetadataLoading, statesData, substatesData, createSubstate, modifySubstate, deleteSubstate, deleteSubstates, loadSubStates } = useMetadata();
  const { pageSlugId, togglePageSlugId } = useTicketsPage();

  const columns = useMemo(() => [
    {
      type: CellType.SINGLE_SELECT,
      key: 'name',
      name: 'name',
      display_name: gettext('Substate'),
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
    }, {
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
    deleteRows: deleteSubstates,

  }), [columns, viewsData, createSubstate, modifySubstate, deleteSubstate, deleteSubstates, substatesData]);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-substates`, [projectUuid]);

  const t = useMemo(() => ({
    row: gettext('substate'),
    rows: gettext('substates'),
    Rows: gettext('Substates'),
    Row: gettext('Substate'),
  }), []);

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
    if (context.canModifyRow(row)) {
      list.push({
        label: gettext('Edit substate'),
        callback: () => {
          context.eventBus.dispatch('expand_row', row);
        }
      });
    }
    if (context.canDeleteRow()) {
      list.push({
        label: gettext('Delete substate'),
        callback: () => {
          deleteRow && deleteRow(row._id);
        }
      });
    }
    return list;
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
    loadSubStates(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const unsubscribeNew = eventBus.subscribe(EVENT_BUS_TYPE.NEW_SUBSTATE, () => {
      context.eventBus.dispatch('expand_row');
    });
    return () => {
      unsubscribeNew && unsubscribeNew();
    };
  }, []);

  if (isLoading || isMetadataLoading) return (<CenteredLoading />);

  return (
    <>
      <SeaMetadata
        viewID="0000"
        className="sea-substates-metadata"
        api={api}
        permission={permission}
        localStorageNamePrefix={localStorageName}
        viewTools={[VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.VIEWS, VIEW_TOOL.SEARCH, VIEW_TOOL.SORTS]}
        settings={{ isFilterComputedOnServer: false, isSortComputedOnServer: false, canManageView: false }}
        createContextMenuOptions={createContextMenuOptions}
        cascadeUpdateCells={cascadeUpdateCells}
        t={t}
      >
        <OptionDialog type={gettext('substate')} parentOptions={statesData.rows} />
      </SeaMetadata>
    </>
  );
};

export default AllSubstates;
