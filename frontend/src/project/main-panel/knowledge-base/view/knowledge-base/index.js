import React, { useMemo, useState, useCallback } from 'react';
import { gettext } from '@/constants';
import SeaMetadata, { CollaboratorsProvider } from '@/sea-metadata';
import { knowledgeBaseAPI } from '../../../../api';
import { KNOWLEDGE_PREDEFINED_COLUMN_CONFIG, KNOWLEDGE_NOT_DISPLAY_COLUMNS, KNOWLEDGE_PREDEFINED_COLUMN_NAME } from './constants';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';

const KnowledgeBase = ({ projectUuid, permission }) => {
  const [viewID, toggleView] = useState('0000');

  const api = useMemo(() => {
    const getMetadata = (...params) => {
      return knowledgeBaseAPI.getKnowledgeBase(projectUuid, ...params).then(res => {
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
      deleteRow: (recordNumber) => knowledgeBaseAPI.deleteRecord(projectUuid, recordNumber),
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
    list.push({ label: gettext('Edit record'), callback: () => {
      const questionColumn = getColumnByName(table.columns, KNOWLEDGE_PREDEFINED_COLUMN_NAME.QUESTION);
      const answerColumn = getColumnByName(table.columns, KNOWLEDGE_PREDEFINED_COLUMN_NAME.ANSWER);
      const newRow = {
        _id: row._id,
        question: getCellValueByColumn(row, questionColumn),
        answer: getCellValueByColumn(row, answerColumn),
      };
      // to do open edit page
    } });
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

  const listUserInfo = useCallback((...params) => knowledgeBaseAPI.listUserInfo(...params), []);
  const getCollaborators = useCallback(() => knowledgeBaseAPI.listProjectRelatedUsers(projectUuid), [projectUuid]);

  return (
    <CollaboratorsProvider
      listUserInfo={listUserInfo}
      getCollaborators={getCollaborators}
    >
      <SeaMetadata
        viewID={viewID}
        api={api}
        permission={permission}
        isViewComputedOnServer={true}
        localStorageNamePrefix={localStorageName}
        toggleView={toggleView}
        t={t}
        createContextMenuOptions={createContextMenuOptions}
      />
    </CollaboratorsProvider>
  );
};

export default KnowledgeBase;
