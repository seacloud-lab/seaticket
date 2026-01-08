import React, { useMemo, useCallback } from 'react';
import { gettext } from '@/constants';
import SeaMetadata from '@/sea-metadata';
import context from '@/sea-metadata/context';
import { useKnowledgePage } from '../../hooks/knowledge-page';
import { useMetadata } from '../../hooks/metadata';
import { knowledgeBaseAPI } from '@/project/api';
import { KNOWLEDGE_PREDEFINED_COLUMN_CONFIG, KNOWLEDGE_NOT_DISPLAY_COLUMNS, KNOWLEDGE_PAGE_SLUG_ID, KB_TABLE_NAME } from '../../constants';
import { generatorKnowledgeContextMenuOptions } from '../../utils';
import { convertRowToNameValue } from '@/sea-metadata/utils/row';
import { CenteredLoading } from '@/components';
import { useData } from '@/project/hooks';

const AllKnowledge = ({ projectUuid, permission, editorAPI }) => {
  const { viewID, toggleView, togglePageSlugId } = useKnowledgePage();
  const { isLoading: isMetadataLoading, tagsData, createTag } = useMetadata();
  const {
    getTableViews, getTableView, insertView, deleteView, modifyView, moveView, duplicateView,
    getMetadata, modifyRow, deleteRow, deleteRows,
  } = useData();

  const expandRow = useCallback((row) => {
    togglePageSlugId(row._id);
  }, [togglePageSlugId]);

  const api = useMemo(() => {
    return {
      getMetadata: (...params) => {
        return getMetadata(KB_TABLE_NAME, params[0], () => knowledgeBaseAPI.getKnowledgeBases(projectUuid, ...params)).then(res => {
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
          const tagsColumn = columns.find(c => c.name === 'tags');
          if (tagsColumn) {
            context.setSetting('tagsColumnKey', tagsColumn.key);
          }
          return { data: { rows, columns } };
        });
      },
      getViews: () => getTableViews(KB_TABLE_NAME, () => knowledgeBaseAPI.listViews(projectUuid)),
      // view
      getView: (viewID) => getTableView(KB_TABLE_NAME, viewID, () => knowledgeBaseAPI.getView(projectUuid, viewID)),
      insertView: (name, viewData) => insertView(KB_TABLE_NAME, () => knowledgeBaseAPI.insertView(projectUuid, name, viewData)),
      modifyView: (viewID, viewData) => modifyView(KB_TABLE_NAME, viewID, viewData, () => knowledgeBaseAPI.modifyView(projectUuid, viewID, viewData)),
      deleteView: (viewID) => deleteView(KB_TABLE_NAME, viewID, () => knowledgeBaseAPI.deleteView(projectUuid, viewID)),
      moveView: (sourceViewID, targetViewID) => moveView(KB_TABLE_NAME, sourceViewID, targetViewID, () => knowledgeBaseAPI.moveView(projectUuid, sourceViewID, targetViewID)),
      duplicateView: (viewID) => duplicateView(KB_TABLE_NAME, () => knowledgeBaseAPI.duplicateView(projectUuid, viewID)),

      // row
      insertRow: () => togglePageSlugId(KB_TABLE_NAME.NEW),
      modifyRow: (row_id, row_update, isCopyPaste, { data, typesData, tagsData } = {}) => {
        const rowData = convertRowToNameValue(row_update, { data, typesData, tagsData });
        return modifyRow(KB_TABLE_NAME, row_id, row_update, () => knowledgeBaseAPI.updateRecord(projectUuid, row_id, rowData, isCopyPaste));
      },
      deleteRow: (recordId) => deleteRow(KB_TABLE_NAME, recordId, () => knowledgeBaseAPI.deleteRecord(projectUuid, recordId)),
      deleteRows: (recordIds) => deleteRows(KB_TABLE_NAME, recordIds, () => knowledgeBaseAPI.deleteRecords(projectUuid, recordIds)),

      uploadFile: (file) => knowledgeBaseAPI.uploadFile(projectUuid, file),
      convertViewToExcel: (viewId) => knowledgeBaseAPI.convertViewToExcel(projectUuid, viewId),
      queryIOStatus: (taskId) => knowledgeBaseAPI.queryIOStatus(taskId),
      getExportExcelUrl: (taskId, viewId) => knowledgeBaseAPI.getExportExcelUrl(projectUuid, taskId, viewId),
      importExcel: (file, previewOnly) => knowledgeBaseAPI.importExcel(projectUuid, file, previewOnly),
      commitImportExcel: (fileName) => knowledgeBaseAPI.commitImportExcel(projectUuid, fileName),
    };
  }, [projectUuid]);

  const createContextMenuOptions = useCallback((props) => {
    return generatorKnowledgeContextMenuOptions({ ...props });
  }, []);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-knowledge-base`, []);

  const t = useMemo(() => ({
    row: gettext('record'),
    rows: gettext('records'),
    Row: gettext('Record'),
    Rows: gettext('Records'),
  }), []);

  if (isMetadataLoading) return (<CenteredLoading />);

  return (
    <SeaMetadata
      viewID={viewID}
      api={api}
      permission={permission}
      settings={{ enableExportAndImportXlsx: true }}
      localStorageNamePrefix={localStorageName}
      toggleView={toggleView}
      expandRow={expandRow}
      t={t}
      createContextMenuOptions={createContextMenuOptions}
      tagsData={tagsData}
      createTag={createTag}
      toggleAllTags={() => togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.TAGS)}
    />
  );
};

export default AllKnowledge;
