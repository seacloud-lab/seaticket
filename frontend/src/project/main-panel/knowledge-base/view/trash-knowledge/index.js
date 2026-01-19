import React, { useMemo, useCallback } from 'react';
import { knowledgeBaseAPI } from '@/project/api';
import SeaMetadata, { VIEW_TOOL } from '@/sea-metadata';
import context from '@/sea-metadata/context';
import { gettext } from '@/constants';
import { CenteredLoading, toaster } from '@/components';
import { KNOWLEDGE_PREDEFINED_COLUMN_CONFIG, KNOWLEDGE_NOT_DISPLAY_COLUMNS, KB_TABLE_NAME } from '../../constants';
import { useMetadata } from '../../hooks';
import { useData } from '@/project/hooks';

const TrashKnowledge = ({ projectUuid, permission }) => {
  const { modifyView, getMetadata, restoreRows } = useData();
  const { isLoading: isMetadataLoading, tagsData } = useMetadata();

  const viewsData = useMemo(() => ({
    navigation: [{ _id: 'all', type: 'view' }],
    views: [{ _id: 'all', name: gettext('All') }]
  }), []);

  const api = useMemo(() => ({
    getMetadata: (...params) => {
      return getMetadata(KB_TABLE_NAME, { ...params[0], view_id: 'trash' }, () => knowledgeBaseAPI.listTrashKnowledgeBases(projectUuid, ...params), true).then(res => {
        let rows = res?.data?.records || [];
        const rawColumns = res?.data?.columns || [];

        const pkRawColumn = rawColumns.find(c => c.name === '_pk');
        const pkColumnId = pkRawColumn ? (pkRawColumn.id || pkRawColumn.key) : undefined;

        let columns = rawColumns
          .filter(c => !KNOWLEDGE_NOT_DISPLAY_COLUMNS.includes(c.name))
          .map(c => {
            const columnId = c.id || c.key;
            return {
              ...c,
              ...KNOWLEDGE_PREDEFINED_COLUMN_CONFIG[c.name],
              id: columnId,
              key: columnId,
            };
          });

        rows = rows.map(row => {
          const newRow = { ...row };
          columns.forEach(c => {
            const id = c.id;
            const name = c.name;
            if (id && (newRow[id] === undefined) && (newRow[name] !== undefined)) {
              newRow[id] = newRow[name];
            }
            if (name && (newRow[name] === undefined) && (newRow[id] !== undefined)) {
              newRow[name] = newRow[id];
            }
          });

          if (pkColumnId) {
            const pkValue = newRow[pkColumnId] ?? newRow['_pk'] ?? newRow._pk ?? newRow._id;
            if (pkValue !== undefined) {
              newRow[pkColumnId] = pkValue;
              newRow._pk = pkValue;
              newRow._id = pkValue;
            }
          } else {
            const pkValue = newRow._id ?? newRow._pk;
            if (pkValue !== undefined) {
              newRow._pk = pkValue;
              newRow._id = pkValue;
            }
          }
          return newRow;
        });

        const tagsColumn = columns.find(c => c.name === 'tags');
        if (tagsColumn) {
          context.setSetting('tagsColumnKey', tagsColumn.key);
        }
        return { data: { rows, columns } };
      });
    },
    getViews: () => Promise.resolve({ data: viewsData }),
    getView: () => Promise.resolve({
      data: { view: { ...viewsData.views[0], sorts: context.localStorage.getItem('sorts') || [] } }
    }),
    modifyView: (viewID, viewData) => modifyView(KB_TABLE_NAME, viewID, viewData, () => new Promise((resolve, reject) => {
      Object.keys(viewData).forEach(key => {
        context.localStorage.setItem(key, viewData[key]);
      });
      resolve({ data: { success: true } });
    }), true),
  }), [projectUuid, viewsData, modifyView, getMetadata]);

  const t = useMemo(() => ({
    row: gettext('record'),
    rows: gettext('records'),
    Row: gettext('Record'),
    Rows: gettext('Records'),
  }), []);

  const createRowsTools = useCallback(({ rows, deleteLocalRows, selectNone }) => {
    return [{
      key: 'restore',
      icon: 'revoke',
      label: gettext('Restore'),
      callback: (event) => {
        event && event.stopPropagation();
        event?.nativeEvent && event.nativeEvent.stopImmediatePropagation();
        const rowIds = rows.map(r => r._id);
        knowledgeBaseAPI.restoreRecords(projectUuid, rowIds).then(() => {
          deleteLocalRows(rowIds);
          selectNone && selectNone();
          toaster.success(gettext('Records restored'));
          restoreRows(KB_TABLE_NAME, rowIds);
        }).catch(() => {
          toaster.danger(gettext('Failed to restore records'));
        });
      }
    }];
  }, [projectUuid, restoreRows]);

  const createContextMenuOptions = useCallback(({
    isGroupView,
    selectedPosition,
    table,
    rowMetrics,
    deleteLocalRows,
    rowGetterByIndex,
    selectNone,
  }) => {
    let list = [];
    const selectedRowIds = rowMetrics ? Object.keys(rowMetrics.idSelectedRowMap) : [];
    if (selectedRowIds.length > 1) {
      const rows = selectedRowIds.map(id => table.id_row_map[id]).filter(Boolean);
      if (rows.length > 0) {
        list.push({
          label: gettext('Restore'),
          key: 'restore',
          callback: () => {
            const rowIds = rows.map(r => r._id);
            knowledgeBaseAPI.restoreRecords(projectUuid, rowIds).then(() => {
              deleteLocalRows(rowIds);
              selectNone && selectNone();
              toaster.success(gettext('Records restored'));
            }).catch(() => toaster.danger(gettext('Failed to restore records')));
          }
        });
      }
      return list;
    }
    if (!selectedPosition) return list;
    const { groupRowIndex, rowIdx: rowIndex } = selectedPosition;
    const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex }) || table.id_row_map[selectedRowIds[0]];
    if (!row) return list;
    list.push({
      label: gettext('Restore'),
      key: 'restore',
      callback: () => {
        const rowId = row._id;
        knowledgeBaseAPI.restoreRecords(projectUuid, [rowId]).then(() => {
          deleteLocalRows([rowId]);
          selectNone && selectNone();
          toaster.success(gettext('Records restored'));
        }).catch(() => toaster.danger(gettext('Failed to restore records')));
      }
    });
    return list;
  }, [projectUuid]);

  if (isMetadataLoading) return (<CenteredLoading />);

  return (
    <SeaMetadata
      viewID="all"
      api={api}
      permission={permission}
      localStorageNamePrefix={`sea-qa-${projectUuid}-kb-trash`}
      createContextMenuOptions={createContextMenuOptions}
      createRowsTools={createRowsTools}
      viewTools={[VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.SEARCH, VIEW_TOOL.SORTS]}
      isViewComputedOnServer={false}
      tagsData={tagsData}
      t={t}
    />
  );
};

export default TrashKnowledge;
