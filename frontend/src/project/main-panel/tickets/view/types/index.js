import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTicketsPage, useMetadata } from '../../hooks';
import { CenteredLoading } from '@/components';
import { gettext } from '@/constants';
import OptionDialog from '../../components/option-dialog';
import SeaMetadata, { CellType, VIEW_TOOL } from '@/sea-metadata';
import context from '@/sea-metadata/context';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '../../../../constants';

const AllTypes = ({ projectUuid, permission }) => {
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: isMetadataLoading, typesData, createType, modifyType, deleteType, deleteTypes, loadTypes } = useMetadata();
  const { pageSlugId, togglePageSlugId } = useTicketsPage();

  const columns = useMemo(() => [
    {
      type: CellType.SINGLE_SELECT,
      key: 'name',
      name: 'name',
      display_name: gettext('Type'),
      editable: false,
      is_name_column: true,
      frozen: true,
      click: (row) => togglePageSlugId(pageSlugId, row._id)
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
          rows: typesData.rows,
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
    insertRow: createType,
    modifyRow: (...params) => modifyType(...params),
    deleteRow: (...params) => deleteType(...params),
    deleteRows: (...params) => deleteTypes(...params),

  }), [projectUuid, columns, viewsData, createType, deleteType, deleteTypes, typesData]);

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
          label: gettext('Delete types'),
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
        label: gettext('Edit type'),
        callback: () => {
          context.eventBus.dispatch('expand_row', row);
        }
      });
    }

    if (context.canDeleteRow()) {
      list.push({
        label: gettext('Delete type'),
        callback: () => {
          deleteRow && deleteRow(row._id);
        }
      });
    }
    return list;
  }, []);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-types`, [projectUuid]);

  const t = useMemo(() => {
    return {
      row: gettext('type'),
      rows: gettext('types'),
      Rows: gettext('Types'),
    };
  }, []);

  useEffect(() => {
    loadTypes(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const unsubscribeNewType = eventBus.subscribe(EVENT_BUS_TYPE.NEW_TYPE, () => {
      context.eventBus.dispatch('expand_row');
    });
    return () => {
      unsubscribeNewType();
    };
  }, []);

  if (isLoading || isMetadataLoading) return (<CenteredLoading />);

  return (
    <>
      <SeaMetadata
        viewID="0000"
        className="sea-types-metadata"
        api={api}
        permission={permission}
        localStorageNamePrefix={localStorageName}
        createContextMenuOptions={createContextMenuOptions}
        viewTools={[VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.VIEWS, VIEW_TOOL.SEARCH, VIEW_TOOL.SORTS]}
        settings={{ isFilterComputedOnServer: false, isSortComputedOnServer: false, canManageView: false }}
        t={t}
      >
        <OptionDialog type={gettext('type')} canModifyDescription={false} />
      </SeaMetadata>
    </>
  );

};

export default AllTypes;
