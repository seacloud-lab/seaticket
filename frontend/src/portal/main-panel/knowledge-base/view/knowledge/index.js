import React, { useCallback, useRef, useState, useEffect } from 'react';
import { CenteredLoading, toaster } from '@/components';
import { KB_TABLE_NAME, KNOWLEDGE_PAGE_SLUG_ID } from '../../constants';
import { Utils } from '@/utils/utils';
import { portalAPI } from '@/portal/api';
import { usePortalKnowledgePage } from '../../hooks/knowledge-page';
import { useData, useTags } from '@/project/hooks';
import { convertRowToKeyValue } from '@/sea-metadata/utils/row';
import Preview from '@/project/main-panel/knowledge-base/view/knowledge/preview';

const PortalEditKnowledge = ({ editorAPI, projectUuid }) => {
  const { modifyLocalRow, getTableByName } = useData();
  const { tagsData } = useTags();
  const { pageSlugId } = usePortalKnowledgePage();

  const [isLoading, setLoading] = useState(true);
  const [knowledge, setKnowledge] = useState(null);

  const lastRecordId = useRef('');

  const handleUpdateRowsCacheData = useCallback((ticketID, update) => {
    const table = getTableByName(KB_TABLE_NAME);
    const columns = Object.values(table.key_column_map);
    if (columns.length === 0) return;
    modifyLocalRow(KB_TABLE_NAME, ticketID, convertRowToKeyValue(update, { data: { columns }, tagsData }));
  }, [tagsData, getTableByName, modifyLocalRow]);

  useEffect(() => {
    if (Object.values(KNOWLEDGE_PAGE_SLUG_ID).includes(pageSlugId)) return;
    if (lastRecordId.current === pageSlugId) return;
    lastRecordId.current = pageSlugId;
    setLoading(true);
    portalAPI.getKBRecord(projectUuid, pageSlugId).then(res => {
      handleUpdateRowsCacheData(pageSlugId, res?.data.record);
      const { record } = res?.data || {};
      setKnowledge(record);
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [projectUuid, pageSlugId, handleUpdateRowsCacheData]);

  if (isLoading) return (<CenteredLoading />);

  return (<Preview knowledge={knowledge} />);

};

export default PortalEditKnowledge;
