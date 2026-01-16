import React, { useMemo, useCallback, useState, useRef } from 'react';
import SeaMetadata, { VIEW_TOOL } from '@/sea-metadata';
import context from '@/sea-metadata/context';
import { EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { gettext } from '@/constants';
import { portalAPI } from '../api';
import KnowledgeBaseDetails from './knowledge-base-details';
import { KNOWLEDGE_PREDEFINED_COLUMN_CONFIG, KNOWLEDGE_NOT_DISPLAY_COLUMNS } from '@/project/main-panel/knowledge-base/constants';

const viewTools = [
  VIEW_TOOL.VIEWS,
  VIEW_TOOL.SEARCH,
  VIEW_TOOL.FILTERS,
  VIEW_TOOL.SORTS,
  VIEW_TOOL.GROUPBYS,
  VIEW_TOOL.ROW_HEIGHT,
  VIEW_TOOL.ORDER_HIDDEN,
];

const KnowledgeBase = ({ projectUuid }) => {
  const metadataRef = useRef(null);
  const [viewID, setViewID] = useState('0000');

  const api = useMemo(() => ({
    getMetadata: (params = {}) => {
      const { view_id = viewID, start = 0, limit = 100 } = params;
      return portalAPI.listKBRecords(projectUuid, { view_id, start, limit }).then(res => {
        const rows = res?.data?.records || [];
        let columns = res?.data?.columns || [];
        columns = columns
          .filter(c => !KNOWLEDGE_NOT_DISPLAY_COLUMNS.includes(c.name))
          .map(c => ({ ...c, ...(KNOWLEDGE_PREDEFINED_COLUMN_CONFIG[c.name] || {}) }));
        const tagsColumn = columns.find(c => c.name === 'tags');
        if (tagsColumn) {
          context.setSetting('tagsColumnKey', tagsColumn.key);
        }
        return { data: { rows, columns } };
      });
    },

    getViews: () => portalAPI.listKBViews(projectUuid),

    getView: (id) => {
      const sorts = context.localStorage.getItem('sorts') || [];
      const groupbys = context.localStorage.getItem('groupbys') || [];
      const filters = context.localStorage.getItem('filters') || [];
      const filter_conjunction = context.localStorage.getItem('filter_conjunction') || 'And';
      const basic_filters = context.localStorage.getItem('basic_filters') || [];
      const row_height = context.localStorage.getItem('row_height') || '';
      const hidden_columns = context.localStorage.getItem('hidden_columns') || [];
      const columns_keys = context.localStorage.getItem('columns_keys') || [];
      return Promise.resolve({ data: { view: { _id: id, sorts, groupbys, filters, filter_conjunction, basic_filters, row_height, hidden_columns, columns_keys } } });
    },

    modifyView: (_id, viewData) => {
      return new Promise((resolve) => {
        Object.keys(viewData).forEach(key => {
          context.localStorage.setItem(key, viewData[key]);
        });
        resolve({ data: { success: true } });
      });
    },
  }), [projectUuid, viewID]);

  const localStorageName = useMemo(() => `sea-qa-portal-${projectUuid}-knowledge-base`, [projectUuid]);

  const t = useMemo(() => ({
    row: gettext('record'),
    rows: gettext('records'),
    Row: gettext('Record'),
    Rows: gettext('Records'),
  }), []);

  const toggleView = useCallback((newViewID) => {
    setViewID(newViewID);
  }, []);

  return (
    <SeaMetadata
      ref={metadataRef}
      viewID={viewID}
      api={api}
      t={t}
      localStorageNamePrefix={localStorageName}
      permission={{ isAdmin: false, canEdit: false }}
      toggleView={toggleView}
      settings={{
        isFilterComputedOnServer: false,
        isSortComputedOnServer: false,
        canManageView: false,
        canInsertRow: false,
        canDeleteRow: false,
        canModifyRow: false,
      }}
      viewTools={viewTools}
      expandRow={(row) => context.eventBus.dispatch(EVENT_BUS_TYPE.EXPAND_ROW, row)}
    >
      <KnowledgeBaseDetails />
    </SeaMetadata>
  );
};

export default KnowledgeBase;
