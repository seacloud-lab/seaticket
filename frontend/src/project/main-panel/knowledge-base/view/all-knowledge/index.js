import React, { useMemo, useCallback } from 'react';
import { gettext } from '@/constants';
import SeaMetadata from '@/sea-metadata';
import context from '@/sea-metadata/context';
import { useKnowledgePage } from '../../hooks/knowledge-page';
import { useMetadata } from '../../hooks/metadata';
import { knowledgeBaseAPI } from '@/project/api';
import { KNOWLEDGE_PREDEFINED_COLUMN_CONFIG, KNOWLEDGE_NOT_DISPLAY_COLUMNS, KNOWLEDGE_PAGE_SLUG_ID } from '../../constants';
import { generatorKnowledgeContextMenuOptions, convertRowToServerData } from '../../utils';

const AllKnowledge = ({ projectUuid, permission, editorAPI }) => {
  const { viewID, toggleView, togglePageSlugId } = useKnowledgePage();
  const { tagsData, createTag } = useMetadata();

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
        const tagsColumn = columns.find(c => c.name === 'tags');
        if (tagsColumn) {
          context.setSetting('tagsColumnKey', tagsColumn.key);
        }
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
      modifyRow: (row_id, row_update, isCopyPaste, { data, tagsData } = {}) => {
        const rowData = convertRowToServerData(row_update, { data, tagsData });
        return knowledgeBaseAPI.updateRecord(projectUuid, row_id, rowData);
      },
      deleteRow: (recordId) => knowledgeBaseAPI.deleteRecord(projectUuid, recordId),
      deleteRows: (recordIds) => knowledgeBaseAPI.deleteRecords(projectUuid, recordIds),
      uploadFile: (file) => knowledgeBaseAPI.uploadFile(projectUuid, file),
      convertViewToExcel: (viewId) => knowledgeBaseAPI.convertViewToExcel(projectUuid, viewId),
      queryIOStatus: (taskId) => knowledgeBaseAPI.queryIOStatus(taskId),
      getExportExcelUrl: (taskId, viewId) => knowledgeBaseAPI.getExportExcelUrl(projectUuid, taskId, viewId),
      importExcel: (file, previewOnly) => knowledgeBaseAPI.importExcel(projectUuid, file, previewOnly),
      commitImportExcel: (fileName) => knowledgeBaseAPI.commitImportExcel(projectUuid, fileName),
    };
  }, [projectUuid, tagsData]);

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
