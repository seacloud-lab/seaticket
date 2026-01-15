import React, { useCallback, useMemo } from 'react';
import { knowledgeBaseAPI } from '../../../../api';
import SeaMetadata, { VIEW_TOOL } from '@/sea-metadata';
import context from '@/sea-metadata/context';
import { useKnowledgePage, useMetadata } from '../../hooks';
import { KNOWLEDGE_PAGE_SLUG_ID, KNOWLEDGE_CHILDREN_PAGE_SLUG_ID, KNOWLEDGE_PREDEFINED_COLUMN_CONFIG, KNOWLEDGE_NOT_DISPLAY_COLUMNS } from '../../constants';
import { gettext } from '@/constants';
import { CenteredLoading } from '@/components';
import { getRowById } from '@/sea-metadata/utils/row';
import { generatorKnowledgeContextMenuOptions } from '../../utils';
import { convertRowToNameValue } from '@/sea-metadata/utils/row';

const TagKnowledge = ({ projectUuid, permission }) => {

  const { isLoading, pageSlugId, childrenPageSlugId, togglePageSlugId } = useKnowledgePage();
  const { isLoading: isTagsLoading, tagsData, createTag } = useMetadata();

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
      return knowledgeBaseAPI.listKnowledgeBaseByTag(projectUuid, childrenPageSlugId).then(res => {
        let rows = res?.data?.records || [];
        const rawColumns = res?.data?.columns || [];

        const pkRawColumn = rawColumns.find(c => c.name === '_pk');
        const pkColumnKey = pkRawColumn ? (pkRawColumn.id || pkRawColumn.key) : undefined;

        let columns = rawColumns;
        columns = columns.filter(c => !KNOWLEDGE_NOT_DISPLAY_COLUMNS.includes(c.name)).map(c => {
          const { name } = c;
          const predefinedConfig = KNOWLEDGE_PREDEFINED_COLUMN_CONFIG[name];
          const columnId = c.id || c.key;
          return {
            ...c,
            ...predefinedConfig,
            original_key: c.key,
            key: columnId,
          };
        });

        rows = rows.map(row => {
          const newRow = { ...row };
          columns.forEach(c => {
            const id = c.key;
            const name = c.name;
            if (id && (newRow[id] === undefined) && (newRow[name] !== undefined)) {
              newRow[id] = newRow[name];
            }
            if (name && (newRow[name] === undefined) && (newRow[id] !== undefined)) {
              newRow[name] = newRow[id];
            }
          });
          if (pkColumnKey) {
            const pkValue = newRow[pkColumnKey] ?? newRow._pk ?? newRow._id;
            if (pkValue !== undefined) {
              newRow[pkColumnKey] = pkValue;
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

    modifyRow: (row_id, row_update, isCopyPaste, { data, tagsData } = {}) => {
      const rowData = convertRowToNameValue(row_update, { data, tagsData });
      console.log('modifyRow rowData:', rowData);
      return knowledgeBaseAPI.updateRecord(projectUuid, row_id, rowData);
    },
    deleteRow: (recordId) => knowledgeBaseAPI.deleteRecord(projectUuid, recordId),
    deleteRows: (recordIds) => knowledgeBaseAPI.deleteRecords(projectUuid, recordIds),
    uploadFile: (file) => knowledgeBaseAPI.uploadFile(projectUuid, file),

  }), [projectUuid, childrenPageSlugId, viewsData, togglePageSlugId]);

  const createContextMenuOptions = useCallback((props) => {
    return generatorKnowledgeContextMenuOptions({ ...props });
  }, []);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-tag-tickets`, [projectUuid]);

  const t = useMemo(() => ({
    row: gettext('record'),
    rows: gettext('records'),
    Row: gettext('Record'),
    Rows: gettext('Records'),
  }), []);

  if (isLoading || isTagsLoading) return (<CenteredLoading />);
  const tag = getRowById(tagsData, childrenPageSlugId);
  if (!tag) {
    togglePageSlugId(pageSlugId, KNOWLEDGE_CHILDREN_PAGE_SLUG_ID.ALL);
    return null;
  }

  return (
    <SeaMetadata
      viewID="0000"
      api={api}
      settings={{ isFilterComputedOnServer: false, isSortComputedOnServer: false, canManageView: false }}
      permission={permission}
      localStorageNamePrefix={localStorageName}
      createContextMenuOptions={createContextMenuOptions}
      expandRow={(row) => togglePageSlugId(row._id)}
      viewTools={[VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.SEARCH, VIEW_TOOL.SORTS]}

      // tags
      tagsData={tagsData}
      createTag={createTag}
      toggleAllTags={() => togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.TAGS)}

      t={t}
    />
  );
};

export default TagKnowledge;
