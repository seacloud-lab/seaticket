import React, { useEffect, useCallback, useState, Fragment } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import dayjs from 'dayjs';
import { getPreviewContent } from '@seafile/seafile-editor';
import { gettext, mediaUrl } from '@/constants';
import { ModalHeader, CenteredError, CenteredLoading, EmptyTip } from '@/components';
import { CONNECTION_TYPES } from '../../constants';
import { getConnectionIcon } from '../../utils';
import { connectionsAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import { getNumberDisplayString } from '@/sea-metadata/utils/column';

import './index.css';

const RelatedIssuesDialog = ({ projectUuid, connectionId, row, onClose }) => {
  const [status, setStatus] = useState(''); // 'loading', 'error', 'loaded'
  const [relatedIssues, setRelatedIssues] = useState([]);
  const [errMessage, setErrMessage] = useState('');

  const renderDetail = (content) => {
    try {
      const isMarkdown = true;
      const previewTextNeedSlice = false;
      const result = getPreviewContent(content, isMarkdown, previewTextNeedSlice);
      if (!result || !result.previewText) return '';
      const { previewText } = result;
      return previewText;
    } catch (error) {
      console.error('Error rendering content preview:', error);
      return content || '';
    }
  };

  const handleItemClick = (issue) => {
    if (issue.url) {
      window.open(issue.url);
    }
  };

  const getDetails = useCallback(() => {
    setStatus('loading');
    connectionsAPI.findRelatedRecords(projectUuid, connectionId, row._id)
      .then(res => {
        const relatedRecords = res.data.related_records || [];
        setRelatedIssues(relatedRecords);
        setStatus('loaded');
      }).catch((error) => {
        const errMessage = Utils.getErrorMsg(error);
        setErrMessage(errMessage);
        setStatus('error');
      });
  }, [projectUuid, row, connectionId]);

  useEffect(() => {
    getDetails();
  }, [projectUuid, row, connectionId]);

  return (
    <Modal className='sea-qa-related-issues-dialog' isOpen={true} toggle={onClose} style={{ minWidth: 1100 }}>
      <ModalHeader toggle={onClose}>{gettext('Related issues')}</ModalHeader>
      <ModalBody>
        {status === 'loading' && (
          <CenteredLoading />
        )}
        {status === 'error' && (
          <CenteredError>{errMessage}</CenteredError>
        )}
        {status === 'loaded' && (
          <Fragment>
            {!relatedIssues.length && <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} />}
            {relatedIssues.length && (
              <div className='issues-list-container'>
                {relatedIssues.map((issue) => {
                  const connectionType = issue.type;
                  const connectionOption = CONNECTION_TYPES.find(c => c.type === connectionType);

                  return (
                    <div className='issues-list-item' key={issue._id} onClick={() => handleItemClick(issue)}>
                      <div className='issues-list-item-icon'>
                        <img src={getConnectionIcon(connectionType)} alt={connectionOption?.name} className='sea-qa-project-connection-type-icon' />
                      </div>
                      <div className='issues-list-item-content'>
                        <div className='issues-list-item-title'>
                          <div>
                            <span className='text-truncate issues-list-item-title-content'>{issue.title || gettext('No title')}</span>
                            <span className='issues-list-item-score'>
                              {getNumberDisplayString(issue.score || '', { format: 'number', enable_precision: true, precision: 2 })}
                            </span>
                          </div>
                          <div className='issues-list-item-time' title={dayjs(issue.modified_time || '').format('YYYY-MM-DD HH:mm:ss')}>
                            {dayjs(issue.modified_time || '').format('YYYY-MM-DD HH:mm:ss')}
                          </div>
                        </div>
                        <div className='issues-list-item-path'>{issue.url || ''}</div>
                        <div className='issues-list-item-detail' dangerouslySetInnerHTML={{ __html: renderDetail(issue.content || issue.ai_summary) }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Fragment>
        )}
      </ModalBody>
    </Modal>
  );
};

export default RelatedIssuesDialog;
