import React, { useEffect, useState, useCallback } from 'react';
import { CenteredLoading, CenteredError } from '@/components';
import { knowledgeBaseAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import { downloadFile } from '@/utils/download';
import Preview from '../../view/knowledge/preview';

import './index.css';

const KBInDialog = ({ projectUuid, knowledgeID, updateKB, getKB = (...params) => knowledgeBaseAPI.getRecord(...params) }) => {
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
    getKB(projectUuid, knowledgeID).then(res => {
      const { record = {} } = res?.data || {};
      setKnowledge(record);
      updateKB && updateKB(record);
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
    <Preview className="seaqa-kb-in-dialog" knowledge={knowledge} onLinkClick={onLinkClick} />
  );
};

export default KBInDialog;
