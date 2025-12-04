import React, { useState } from 'react';
import { Modal, ModalBody, Nav, NavItem, NavLink } from 'reactstrap';
import { gettext } from '@/constants';
import { ModalHeader } from '@/components';
import { getPreviewContent } from '@seafile/seafile-editor';
import { CONNECTION_TYPES } from '../../constants';
import { getConnectionIcon } from '../../utils';
import { getNumberDisplayString } from '@/sea-metadata/utils/column';
import dayjs from 'dayjs';

import './index.css';

const RelatedIssuesDialog = ({
  isOpen,
  isLoading,
  relatedIssues = [],
  rerankedIssues = [],
  onClose
}) => {
  const [activeTab, setActiveTab] = useState('original');

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

  const currentIssues = activeTab === 'original' ? relatedIssues : rerankedIssues;

  const renderIssuesList = (issues) => {
    if (issues.length === 0) {
      return (
        <div className="text-center py-4">
          <p>{gettext('No related issues found')}</p>
        </div>
      );
    }

    return (
      <div className="issues-list-container">
        {issues.map((issue, index) => {
          const connectionType = issue.type;
          const connectionOption = CONNECTION_TYPES.find(c => c.type === connectionType);

          return (
            <div className="list-item" key={`${issue._id}:${issue.connection_id}`} onClick={() => handleItemClick(issue)}>
              <div className="list-item-icon">
                <img src={getConnectionIcon(connectionType)} alt={connectionOption?.name} className="sea-qa-project-connection-type-icon" />
              </div>
              <div className="list-item-content">
                <div className="list-item-title">
                  <span className="text-truncate list-item-title-content">{issue.title || gettext('No title')}</span>
                  {issue.score && (
                    <span className="list-item-score ml-2">
                      {getNumberDisplayString(issue.score, { format: 'number', enable_precision: true, precision: 2 })}
                    </span>
                  )}
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
    );
  };

  return (
    <Modal className="sea-qa-related-issues-dialog" isOpen={isOpen} toggle={onClose} size="xl">
      <ModalHeader toggle={onClose}>{gettext('Related issues')}</ModalHeader>
      <ModalBody>
        {isLoading ? (
          <div className="d-flex justify-content-center align-items-center loading-container">
            <span className="loading-icon"></span>
          </div>
        ) : (
          <>
            <Nav tabs className="mb-3">
              <NavItem>
                <NavLink
                  className={activeTab === 'original' ? 'active tab-nav-link' : 'tab-nav-link'}
                  onClick={() => setActiveTab('original')}
                >
                  {gettext('Original sorting')}
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink
                  className={activeTab === 'reranked' ? 'active tab-nav-link' : 'tab-nav-link'}
                  onClick={() => setActiveTab('reranked')}
                >
                  {gettext('Reranked sorting')}
                </NavLink>
              </NavItem>
            </Nav>
            {renderIssuesList(currentIssues)}
          </>
        )}
      </ModalBody>
    </Modal>
  );
};

export default RelatedIssuesDialog;
