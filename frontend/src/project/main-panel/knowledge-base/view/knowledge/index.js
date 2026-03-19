import React, { useCallback, useRef, useState, useEffect } from 'react';
import { CenteredLoading, toaster } from '@/components';
import { KB_TABLE_NAME, KNOWLEDGE_PAGE_SLUG_ID } from '../../constants';
import { Utils } from '@/utils/utils';
import { knowledgeBaseAPI } from '@/project/api';
import { useKnowledgePage } from '../../hooks/knowledge-page';
import { useData, useTags } from '@/project/hooks';
import { convertRowToKeyValue } from '@/sea-metadata/utils/row';
import Preview from './preview';
import Edit from './edit';
import { downloadFile } from '@/utils/download';

const EditKnowledge = ({ editorAPI, knowledgeID, projectUuid }) => {
  const [isLoading, setLoading] = useState(true);
  const [knowledge, setKnowledge] = useState(null);

  const { tagsData } = useTags();
  const { modifyLocalRow, getTableByName } = useData();
  const { isKBRecordPreview, toggleKBRecordPreview } = useKnowledgePage();
  const lastKnowledgeID = useRef('');

  const handleUpdateRowsCacheData = useCallback((knowledgeID, update) => {
    const table = getTableByName(KB_TABLE_NAME);
    const columns = Object.values(table.key_column_map);
    if (columns.length === 0) return;
    modifyLocalRow(KB_TABLE_NAME, knowledgeID, convertRowToKeyValue(update, { data: { columns }, tagsData }));
  }, [tagsData, getTableByName, modifyLocalRow]);

  const onChange = useCallback(({ title, content, tags }, callback) => {
    let serverData = { title, content, tags };
    knowledgeBaseAPI.updateRecord(projectUuid, knowledgeID, serverData).then(res => {
      handleUpdateRowsCacheData(knowledgeID, serverData);
      setKnowledge({ ...knowledge, ...serverData, content: content?.text });
      callback && callback();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(error);
    });
  }, [knowledgeID, knowledge, handleUpdateRowsCacheData]);

  const onLinkClick = useCallback((link) => {
    if (link.includes(`/project/${projectUuid}/`)) {
      downloadFile(link);
      return;
    }
    window.open(link, '_blank');
  }, [projectUuid]);

  useEffect(() => {
    if (Object.values(KNOWLEDGE_PAGE_SLUG_ID).includes(knowledgeID)) return;
    if (lastKnowledgeID.current === knowledgeID) return;
    lastKnowledgeID.current = knowledgeID;
    setLoading(true);
    knowledgeBaseAPI.getRecord(projectUuid, knowledgeID).then(res => {
      handleUpdateRowsCacheData(knowledgeID, res?.data.record);
      const { record } = res?.data || {};
      setKnowledge(record);
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [projectUuid, knowledgeID, handleUpdateRowsCacheData]);

  if (isLoading) return (<CenteredLoading />);

  if (isKBRecordPreview) return (<Preview knowledge={knowledge} onLinkClick={onLinkClick} />);

  return (
    <Edit
      knowledge={knowledge}
      editorAPI={editorAPI}
      onChange={onChange}
      toggleKBRecordPreview={toggleKBRecordPreview}
      onLinkClick={onLinkClick}
    />
  );

};

export default EditKnowledge;
