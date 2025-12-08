import React, { useMemo, useCallback } from 'react';
import { gettext } from '@/constants';
import SeaMetadata from '@/sea-metadata';
import { useKnowledgePage } from '../../hooks/knowledge-page';
import { knowledgeBaseAPI } from '@/project/api';
import { KNOWLEDGE_PREDEFINED_COLUMN_CONFIG, KNOWLEDGE_NOT_DISPLAY_COLUMNS } from '../../constants';

const AllKnowledge = ({ projectUuid, permission, editorAPI }) => {
  const { viewID, toggleView, togglePageSlugId } = useKnowledgePage();

  const expandRow = useCallback((row) => {
    togglePageSlugId(row._id);
  }, [togglePageSlugId]);

  const api = useMemo(() => {
    const getMetadata = (...params) => {
      return knowledgeBaseAPI.getKnowledgeBases(projectUuid, ...params).then(res => {
        const rows = res?.data?.records || [];
        let columns = res?.data?.columns || [];
        columns = columns.filter(c => !KNOWLEDGE_NOT_DISPLAY_COLUMNS.includes(c.name)).map(c => {
          const { name } = c;
          const predefinedConfig = KNOWLEDGE_PREDEFINED_COLUMN_CONFIG[name];
          return {
            ...c,
            ...predefinedConfig,
          };
        });
        return { data: { rows, columns } };
      });
    };
    return {
      getMetadata,
      getViews: () => knowledgeBaseAPI.listViews(projectUuid),
      getView: (id) => knowledgeBaseAPI.getView(projectUuid, id),
      insertView: (name, viewData) => knowledgeBaseAPI.insertView(projectUuid, name, viewData),
      deleteView: (id) => knowledgeBaseAPI.deleteView(projectUuid, id),
      moveView: (sourceId, targetId) => knowledgeBaseAPI.moveView(projectUuid, sourceId, targetId),
      duplicateView: (id) => knowledgeBaseAPI.duplicateView(projectUuid, id),
      modifyView: (id, viewData) => knowledgeBaseAPI.modifyView(projectUuid, id, viewData),
      deleteRow: (recordId) => knowledgeBaseAPI.deleteRecord(projectUuid, recordId),
      deleteRows: (recordIds) => knowledgeBaseAPI.deleteRecords(projectUuid, recordIds),
      uploadFile: (file) => knowledgeBaseAPI.uploadFile(projectUuid, file),
    };
  }, []);

  const createContextMenuOptions = useCallback(({ isGroupView, selectedRange, selectedPosition, table, rowMetrics, deleteRow, deleteRows, rowGetterByIndex, context }) => {
    let list = [];
    if (selectedRange) return list;
    const selectedRowIds = rowMetrics ? Object.keys(rowMetrics.idSelectedRowMap) : [];
    if (selectedRowIds.length > 1) {
      if (context.canDeleteRows()) list.push({ label: gettext('Delete records'), callback: () => deleteRows(selectedRowIds) });
      return list;
    }
    if (!selectedPosition) return list;
    const { groupRowIndex, rowIdx: rowIndex } = selectedPosition;
    const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex }) || table.id_row_map[selectedRowIds[0]];
    if (!row) return list;
    if (context.canDeleteRow()) list.push({ label: gettext('Delete record'), callback: () => deleteRow(row._id) });
    return list;
  }, []);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-knowledge-base`, []);

  const t = useMemo(() => ({
    row: gettext('record'),
    rows: gettext('records'),
    Row: gettext('Record'),
    Rows: gettext('Records'),
  }), []);

  return (
    <SeaMetadata
      viewID={viewID}
      api={api}
      permission={permission}
      isViewComputedOnServer={true}
      localStorageNamePrefix={localStorageName}
      toggleView={toggleView}
      expandRow={expandRow}
      t={t}
      createContextMenuOptions={createContextMenuOptions}
    />
  );
};

export default AllKnowledge;
