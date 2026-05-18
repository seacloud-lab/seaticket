import React, { useEffect, useCallback, useState } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import dayjs from 'dayjs';
import { getPreviewContent } from '@seafile/seafile-editor';
import { gettext, mediaUrl } from '@/constants';
import { ModalHeader, CenteredError, CenteredLoading, EmptyTip } from '@/components';
import { CONNECTION_TYPES } from '../../constants';
import { getResourceIconURL } from '@/project/utils';
import { connectionsAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import { formatWithTimezone } from '@/sea-metadata/utils/column';
import { ResourceDetailsDialog } from '@/project/components';
import ResolvedTag from './resolved-tag';

import './index.css';

const RelatedIssuesDialog = ({ projectUuid, connectionId, row, onClose }) => {
  const [status, setStatus] = useState(''); // 'loading', 'error', 'loaded'
  const [relatedIssues, setRelatedIssues] = useState([]);
  const [errMessage, setErrMessage] = useState('');
  const [activeResultIndex, setActiveResultIndex] = useState(-1);

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

  const expandItem = useCallback((index) => {
    setActiveResultIndex(index);
  }, []);

  const switchResult = useCallback((step) => {
    let nextActiveResultIndex = activeResultIndex + step;
    if (nextActiveResultIndex > relatedIssues.length - 1) {
      nextActiveResultIndex = 0;
    }
    if (nextActiveResultIndex < 0) {
      nextActiveResultIndex = relatedIssues.length - 1;
    }
    setActiveResultIndex(nextActiveResultIndex);
  }, [activeResultIndex, relatedIssues]);

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
    <>
      <Modal className='seaqa-related-issues-dialog' isOpen={true} toggle={onClose} style={{ minWidth: 1100 }}>
        <ModalHeader toggle={onClose}>{gettext('Related issues')}</ModalHeader>
        <ModalBody>
          {status === 'loading' && <CenteredLoading />}
          {status === 'error' && <CenteredError>{errMessage}</CenteredError>}
          {status === 'loaded' && (
            <>
              {relatedIssues.length ?
                <div className='issues-list-container'>
                  {relatedIssues.map((issue, index) => {
                    const connectionType = issue.type;
                    const connectionOption = CONNECTION_TYPES.find(c => c.type === connectionType);
                    return (
                      <div className='issues-list-item' key={issue._id} onClick={() => expandItem(index)}>
                        <div className='issues-list-item-icon'>
                          <img src={getResourceIconURL(connectionType)} alt={connectionOption?.name} className='seaqa-project-connection-type-icon' />
                        </div>
                        <div className='issues-list-item-content'>
                          <div className='issues-list-item-title'>
                            <div className="issues-list-item-title-content-container">
                              <span className='text-truncate issues-list-item-title-content' title={issue.title || gettext('No title')}>
                                {issue.title || gettext('No title')}
                              </span>
                              {issue.resolved && <ResolvedTag />}
                            </div>
                            <div className='issues-list-item-time' title={formatWithTimezone(issue.modified_time)}>
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
                :
                <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} title={gettext('No related issues')}/>
              }
            </>
          )}
        </ModalBody>
      </Modal>
      {activeResultIndex > -1 && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={relatedIssues[activeResultIndex]}
          isShowIcon={true}
          switchResource={relatedIssues.length > 1 ? switchResult : null}
          onToggle={() => setActiveResultIndex(-1)}
        />
      )}
    </>

  );
};

export default RelatedIssuesDialog;
