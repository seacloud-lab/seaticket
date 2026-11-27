import React, { useMemo, useCallback, useState, useRef } from 'react';
import { gettext } from '@/constants';
import { portalAPI } from '@/portal/api';
import { KNOWLEDGE_PREDEFINED_COLUMN_CONFIG, KNOWLEDGE_NOT_DISPLAY_COLUMNS, KB_TABLE_NAME, KNOWLEDGE_BASE_TYPE, KNOWLEDGE_PREDEFINED_COLUMN_NAME } from '@/portal/main-panel/knowledge-base/constants';
import { usePortalKnowledgePage } from '@/portal/main-panel/knowledge-base/hooks/knowledge-page';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { useData, useTags } from '@/project/hooks';
import SeaMetadata, { useMetadataController } from '@/sea-metadata';


const PortalAllKnowledge = ({ projectUuid }) => {
  const controller = useMetadataController();
  const { togglePageSlugId } = usePortalKnowledgePage();
  const metadataRef = useRef(null);
  const allColumns = useRef([]);
  const [currentKB, setCurrentKB] = useState(null);
  const [isShowKBDetailsDialog, setIsShowKBDetailsDialog] = useState(false);

  const { tagsData } = useTags();
  const { getMetadata } = useData();

  const api = useMemo(() => ({
    getMetadata: (...params) => {
      return getMetadata(KB_TABLE_NAME, params[0], () => portalAPI.listKBRecords(projectUuid, ...params)).then(res => {
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
          controller.setSetting('tagsColumnKey', tagsColumn.key);
        }
        allColumns.current = columns;
        return { data: { rows, columns } };
      });
    },

    getViews: () => portalAPI.listKBViews(projectUuid),

    getView: (id) => {
      const sorts = controller.storage.getItem('sorts') || [];
      const groupbys = controller.storage.getItem('groupbys') || [];
      const filters = controller.storage.getItem('filters') || [];
      const filter_conjunction = controller.storage.getItem('filter_conjunction') || 'And';
      const basic_filters = controller.storage.getItem('basic_filters') || [];
      const row_height = controller.storage.getItem('row_height') || '';
      const hidden_columns = controller.storage.getItem('hidden_columns') || [];
      const columns_keys = controller.storage.getItem('columns_keys') || [];
      return Promise.resolve({ data: { view: { _id: id, sorts, groupbys, filters, filter_conjunction, basic_filters, row_height, hidden_columns, columns_keys } } });
    },

    modifyView: (_id, viewData) => {
      return new Promise((resolve) => {
        Object.keys(viewData).forEach(key => {
          controller.storage.setItem(key, viewData[key]);
        });
        resolve({ data: { success: true } });
      });
    },
  }), [projectUuid, getMetadata, togglePageSlugId, controller]);

  const localStorageName = useMemo(() => `seaqa-portal-${projectUuid}-knowledge-base`, [projectUuid]);

  const t = useMemo(() => ({
    row: gettext('record'),
    rows: gettext('records'),
    Row: gettext('Record'),
    Rows: gettext('Records'),
  }), []);

  const handleExpandRow = useCallback((kb) => {
    setCurrentKB({ ...kb, type: KNOWLEDGE_BASE_TYPE });
    setIsShowKBDetailsDialog(true);
  }, []);

  const handleSwitchKB = useCallback((step) => {
    const KBData = metadataRef.current?.getOrderRows ? metadataRef.current.getOrderRows() : [];
    const index = KBData.findIndex(r => r._id === currentKB?._id);
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
  }, [currentKB]);

  return (
    <>
      <SeaMetadata
        controller={controller}
        storageNamespace="primary"
        isShowViewInURL={true}
        ref={metadataRef}
        api={api}
        t={t}
        localStorageNamePrefix={localStorageName}
        permission={{ isAdmin: false, canEdit: false }}
        settings={{
          isFilterComputedOnServer: false,
          isSortComputedOnServer: false,
          canManageView: false,
          canInsertRow: false,
          canDeleteRow: false,
          canModifyRow: false,
        }}
        tagsData={tagsData}
        expandRow={handleExpandRow}
      >
      </SeaMetadata>
      {isShowKBDetailsDialog && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={currentKB}
          getKB={(...params) => portalAPI.getKBRecord(...params)}
          columns={allColumns.current}
          switchResource={handleSwitchKB}
          onToggle={() => setIsShowKBDetailsDialog(false)}
        />
      )}
    </>
  );
};

export default PortalAllKnowledge;
