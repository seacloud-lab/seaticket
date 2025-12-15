import React, { useCallback, useMemo } from 'react';
import { knowledgeBaseAPI } from '../../../../api';
import SeaMetadata, { VIEW_TOOL } from '@/sea-metadata';
import context from '@/sea-metadata/context';
import { useKnowledgePage, useMetadata } from '../../hooks';
import { KNOWLEDGE_PAGE_SLUG_ID, KNOWLEDGE_CHILDREN_PAGE_SLUG_ID, KNOWLEDGE_PREDEFINED_COLUMN_CONFIG, KNOWLEDGE_NOT_DISPLAY_COLUMNS } from '../../constants';
import { gettext } from '@/constants';
import { CenteredLoading } from '@/components';
import { getRowById } from '@/sea-metadata/utils/row';
import { convertRowToServerData, generatorKnowledgeContextMenuOptions } from '../../utils';

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
      const rowData = convertRowToServerData(row_update, { data, tagsData });
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
      isViewComputedOnServer={false}
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
