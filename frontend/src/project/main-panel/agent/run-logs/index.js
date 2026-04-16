import React, { useCallback, useState, useRef } from 'react';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import RunCard from './run-card';
import { CenteredLoading, EmptyTip, ModalHeader } from '@/components';
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
  enabledAgent,
}) => {
  const [viewContentModal, setViewContentModal] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const initialContentRef = useRef('');

  const handleViewContent = useCallback((action, runId) => {
    setViewContentModal({ action, runId });
    const initialContent = action.content || action.suggestion_text || '';
    initialContentRef.current = initialContent;
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
        <EmptyTip
          title={gettext('No agent runs')}
          text={!enabledAgent && gettext('Enable the agent in settings to start')}
        />
      </div>
    );
  }

  const filteredRunLogs = runLogs.filter(run => {
    const items = run.items || [];
    return items.length > 0;
  });

  return (
    <div className="agent-run-logs">
      <div className="run-logs-list">
        {filteredRunLogs.map((run, index) => (
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

      <Modal isOpen={!!viewContentModal} toggle={closeViewContentModal} className="view-content-modal" size="lg">
        <ModalHeader toggle={closeViewContentModal}>{gettext('Edit content')}</ModalHeader>
        <ModalBody>
          <textarea
            className="view-content-textarea"
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            placeholder={gettext('Edit content...')}
            spellCheck={false}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={closeViewContentModal}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={handleSaveContent} disabled={isSaving || editContent === initialContentRef.current}>
            {isSaving ? gettext('Saving...') : gettext('Save')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default RunLogs;
