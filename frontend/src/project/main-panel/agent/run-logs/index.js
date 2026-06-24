import React from 'react';
import { Button } from 'reactstrap';
import RunCard from './run-card';
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
  onViewContent,
  enabledAgent,
}) => {
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
      <div className="run-logs-main">
        <div className="run-logs-list">
          {filteredRunLogs.map((run, index) => (
            <RunCard
              key={run.id || index}
              run={run}
              onConfirmAction={onConfirmAction}
              onCancelAction={onCancelAction}
              onViewContent={onViewContent}
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
      </div>
    </div>
  );
};

export default RunLogs;
