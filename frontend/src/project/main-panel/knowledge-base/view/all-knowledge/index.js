import React, { useMemo, useCallback, useRef, useState } from 'react';
import { gettext } from '@/constants';
import SeaMetadata from '@/sea-metadata';
import context from '@/sea-metadata/context';
import { useKnowledgePage } from '../../hooks/knowledge-page';
import { knowledgeBaseAPI } from '@/project/api';
import {
  KNOWLEDGE_PREDEFINED_COLUMN_CONFIG, KNOWLEDGE_NOT_DISPLAY_COLUMNS, KB_TABLE_NAME,
  KNOWLEDGE_PREDEFINED_COLUMN_NAME, KNOWLEDGE_BASE_TYPE,
} from '../../constants';
import { generatorKnowledgeContextMenuOptions } from '../../utils';
import { convertRowToNameValue } from '@/sea-metadata/utils/row';
import { useData, useTags } from '@/project/hooks';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';

const AllKnowledge = ({ projectUuid, permission, editorAPI }) => {
  const { viewID, toggleView, togglePageSlugId } = useKnowledgePage();
  const { tagsData, createTag } = useTags();
  const {
    getTableViews, getTableView, insertView, deleteView, modifyView, moveView, duplicateView,
    getMetadata, modifyRow, deleteRow, deleteRows,
  } = useData();

  const metadataRef = useRef(null);
  const allColumns = useRef([]);

  const [currentKB, setCurrentKB] = useState(null);
  const [isShowKBDetailsDialog, setIsShowKBDetailsDialog] = useState(false);

  const handleExpandRow = useCallback((kb) => {
    setCurrentKB({ ...kb, type: KNOWLEDGE_BASE_TYPE });
    setIsShowKBDetailsDialog(true);
  }, [projectUuid]);

  const api = useMemo(() => {
    return {
      getMetadata: (...params) => {
        return getMetadata(KB_TABLE_NAME, params[0], () => knowledgeBaseAPI.getKnowledgeBases(projectUuid, ...params)).then(res => {
          const rows = res?.data?.records || [];
          let columns = res?.data?.columns || [];
          let predefinedConfig = { ...KNOWLEDGE_PREDEFINED_COLUMN_CONFIG };
          predefinedConfig[KNOWLEDGE_PREDEFINED_COLUMN_NAME.TITLE] = {
            ...predefinedConfig[KNOWLEDGE_PREDEFINED_COLUMN_NAME.TITLE],
            click: (row) => togglePageSlugId(row._id),
          };

          columns = columns.filter(c => !KNOWLEDGE_NOT_DISPLAY_COLUMNS.includes(c.name)).map(c => {
            const { name } = c;
            return {
              ...c,
              ...predefinedConfig[name],
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
  }, [
    projectUuid, getTableViews, getTableView, insertView, deleteView, modifyView, moveView, duplicateView,
    getMetadata, modifyRow, deleteRow, deleteRows, togglePageSlugId,
  ]);

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

  const handleSwitchKB = useCallback((step) => {
    const KBData = metadataRef.current.getOrderRows();
    const index = KBData.findIndex(r => r._id === currentKB._id);
    if (index === -1) return;

    let newIndex = index + step;
    if (newIndex > KBData.length - 1) {
      newIndex = 0;
    }
    if (newIndex < 0) {
      newIndex = KBData.length - 1;
    }
    const kb = KBData[newIndex];
    setCurrentKB({ ...kb, type: KNOWLEDGE_BASE_TYPE });
  }, [currentKB, metadataRef]);

  return (
    <>
      <SeaMetadata
        className="sea-kb-metadata"
        viewID={viewID}
        api={api}
        ref={metadataRef}
        permission={permission}
        settings={{ enableExportAndImportXlsx: true }}
        localStorageNamePrefix={localStorageName}
        toggleView={toggleView}
        expandRow={handleExpandRow}
        t={t}
        createContextMenuOptions={createContextMenuOptions}
        tagsData={tagsData}
        createTag={createTag}
      />
      {isShowKBDetailsDialog && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={currentKB}
          columns={allColumns.current}
          switchResource={handleSwitchKB}
          onToggle={() => setIsShowKBDetailsDialog(false)}
        />
      )}
    </>
  );
};

export default AllKnowledge;
