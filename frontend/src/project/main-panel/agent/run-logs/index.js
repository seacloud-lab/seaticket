import React, { useCallback, useState } from 'react';
import { Button, ModalFooter } from 'reactstrap';
import RunCard from './run-card';
import { CenteredLoading } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const RunLogs = ({
  runLogs,
  isLoading,
  hasMore,
  loadMore,
  onConfirmAction,
  onCancelAction,
  onUpdateContent,
}) => {
  const [viewContentModal, setViewContentModal] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleViewContent = useCallback((action, runId) => {
    setViewContentModal({ action, runId });
    const initialContent = action.content || action.suggestion_text || '';
    setEditContent(initialContent);
  }, []);

  const closeViewContentModal = useCallback(() => {
    setViewContentModal(null);
    setEditContent('');
  }, []);

  const handleSaveContent = useCallback(() => {
    if (!viewContentModal || !onUpdateContent) return;
    const { action, runId } = viewContentModal;
    setIsSaving(true);
    onUpdateContent(runId, action.id, editContent)
      .then(() => {
        closeViewContentModal();
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, [viewContentModal, editContent, onUpdateContent, closeViewContentModal]);

  if (isLoading && runLogs.length === 0) {
    return (
      <div className="agent-run-logs-loading">
        <CenteredLoading />
      </div>
    );
  }

  if (!isLoading && runLogs.length === 0) {
    return (
      <div className="agent-run-logs-empty">
        <p>{gettext('No agent runs yet')}</p>
      </div>
    );
  }

  return (
    <div className="agent-run-logs">
      <div className="run-logs-list">
        {runLogs.map((run, index) => (
          <RunCard
            key={run.id || index}
            run={run}
            onConfirmAction={onConfirmAction}
            onCancelAction={onCancelAction}
            onViewContent={handleViewContent}
          />
        ))}
      </div>

      {hasMore && (
        <div className="load-more-container">
          <button
            className="load-more-btn"
            onClick={loadMore}
            disabled={isLoading}
          >
            {isLoading ? gettext('Loading...') : gettext('Load more')}
          </button>
        </div>
      )}

      {/* View/Edit content modal */}
      {viewContentModal && (
        <div className="view-content-modal-overlay" onClick={closeViewContentModal}>
          <div className="view-content-modal" onClick={e => e.stopPropagation()}>
            <div className="view-content-modal-header">
              <span>{gettext('Edit content')}</span>
            </div>
            <div className="view-content-modal-body">
              <textarea
                className="view-content-textarea"
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                placeholder={gettext('Edit content...')}
                spellCheck={false}
              />
            </div>
            <ModalFooter>
              <Button color="secondary" onClick={closeViewContentModal}>{gettext('Cancel')}</Button>
              <Button color="primary" onClick={handleSaveContent} disabled={isSaving}>
                {isSaving ? gettext('Saving...') : gettext('Save')}
              </Button>
            </ModalFooter>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunLogs;
