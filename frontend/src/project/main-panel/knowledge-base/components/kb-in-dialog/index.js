import React, { useEffect, useCallback, useState } from 'react';
import { CenteredLoading, CenteredError, CustomizeMarkdownViewer } from '@/components';
import { knowledgeBaseAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import { downloadFile } from '@/utils/download';

const KBInDialog = ({ projectUuid, knowledgeID, updateKB }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [knowledge, setKnowledge] = useState('');

  const onLinkClick = useCallback((link) => {
    if (link.includes(`/project/${projectUuid}/`)) {
      downloadFile(link);
      return;
    }
    window.open(link, '_blank');
  }, [projectUuid]);

  useEffect(() => {
    setIsLoading(true);
    knowledgeBaseAPI.getRecord(projectUuid, knowledgeID).then(res => {
      const knowledge = res?.data.record || {};
      setKnowledge(knowledge);
      updateKB(knowledge);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setErrorMessage(errorMessage);
    }).finally(() => {
      setIsLoading(false);
    });
  }, [knowledgeID]);

  if (isLoading) return (<CenteredLoading />);
  if (errorMessage) return (<CenteredError>{errorMessage}</CenteredError>);

  return (
    <CustomizeMarkdownViewer value={knowledge?.content || ''} showTOC={false} onLinkClick={onLinkClick} />
  );
};

export default KBInDialog;
