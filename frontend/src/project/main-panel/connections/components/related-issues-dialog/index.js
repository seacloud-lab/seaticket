import React from 'react';
import { Modal, ModalBody, ModalFooter, Button } from 'reactstrap';
import { gettext } from '@/constants';
import { ModalHeader } from '@/components';
import { getPreviewContent } from '@seafile/seafile-editor';
import { CONNECTION_TYPES } from '../../constants';
import { getConnectionIcon } from '../../utils';
import dayjs from 'dayjs';

import './index.css';

const RelatedIssuesDialog = ({
  isOpen,
  isLoading,
  relatedIssues,
  onClose
}) => {

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

  return (
    <Modal className="sea-qa-related-issues-dialog" isOpen={isOpen} toggle={onClose} size="xl">
      <ModalHeader toggle={onClose}>{gettext('Related Issues')}</ModalHeader>
      <ModalBody>
        {isLoading ? (
          <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
            <span className="loading-icon"></span>
          </div>
        ) : relatedIssues.length > 0 ? (
          <div className="sea-qa-project-search-result-list" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {relatedIssues.map((issue, index) => {

              const connectionType = issue.type;
              const connectionOption = CONNECTION_TYPES.find(c => c.type === connectionType);

              return (
                <div className="list-item" key={issue.pk || issue.id || issue._id || index} onClick={() => handleItemClick(issue)}>
                  <div className="list-item-icon">
                    <img src={getConnectionIcon(connectionType)} alt={connectionOption?.name} className="sea-qa-project-connection-type-icon" />
                  </div>
                  <div className="list-item-content">
                    <div className="list-item-title">
                      <span className="text-truncate list-item-title-content">{issue.title || gettext('No title')}</span>
                    </div>
                    {issue.url && (
                      <div className="list-item-path">{issue.url}</div>
                    )}
                    {issue.modified_time && (
                      <div className="list-item-time" title={dayjs(issue.modified_time).format('YYYY-MM-DD HH:mm:ss')}>
                        {dayjs(issue.modified_time).format('YYYY-MM-DD HH:mm:ss')}
                      </div>
                    )}
                    {(issue.content || issue.ai_summary) &&
                      <div className="list-item-detail" dangerouslySetInnerHTML={{ __html: renderDetail(issue.content || issue.ai_summary) }}></div>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4">
            <p>{gettext('No related issues found')}</p>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onClose}>
          {gettext('Close')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default RelatedIssuesDialog;
