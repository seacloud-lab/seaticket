import React, { useCallback, useState } from 'react';
import { Button } from 'reactstrap';
import RunCard from './run-card';
import SuggestionDetailPanel from './suggestion-detail-panel';
import { CenteredLoading, EmptyTip } from '@/components';
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
  const [contentPanel, setContentPanel] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleViewContent = useCallback((action, runId, mode = 'view') => {
    setContentPanel({
      action,
      runId,
      mode,
      title: action.result || gettext('Suggestion'),
      content: action.suggestion_content || '',
    });
  }, []);

  const closeContentPanel = useCallback(() => {
    setContentPanel(null);
  }, []);

  const handleSaveContent = useCallback((value) => {
    if (!contentPanel || !onUpdateContent) return;
    const { action, runId } = contentPanel;
    setIsSaving(true);
    onUpdateContent(runId, action.id, value)
      .then(() => {
        closeContentPanel();
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, [contentPanel, onUpdateContent, closeContentPanel]);

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

      {hasMore ? (
        <div className="load-more-container">
          <Button
            className="load-more-btn"
            color="outline-primary"
            onClick={loadMore}
            disabled={isLoading}
          >
            {isLoading ? gettext('Loading...') : gettext('Load more')}
          </Button>
        </div>
      ) : (
        <div className="load-more-container">
          <div className="no-more-content">{gettext('No more content')}</div>
        </div>
      )}

      {contentPanel && (
        <SuggestionDetailPanel
          title={contentPanel.title}
          content={contentPanel.content}
          mode={contentPanel.mode}
          isSaving={isSaving}
          onSave={handleSaveContent}
          onClose={closeContentPanel}
        />
      )}
    </div>
  );
};

export default RunLogs;
