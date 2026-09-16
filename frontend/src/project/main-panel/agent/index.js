import React, { useCallback, useMemo, useState } from 'react';
import { EmptyTip, CenteredLoading } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import TopBar from '../top-bar';
import RunLogDetails from './components/run-log-details';
import RunLogs from './components/run-logs';
import { useAgentRunLogs } from './hooks/useAgentRunLogs';

import './index.css';

const Agent = ({ title, settings, modifySettings }) => {
  const [isShowLogs, setIsShowLogs] = useState(true);
  const [updatedRuns, setUpdatedRuns] = useState(null);

  const {
    runLogs,
    isLoading: isRunLogsLoading,
    hasMore,
    loadMore,
    refresh,
    updateRunLog,
    activeLogKey,
    updateActiveLogKey,
    statusFilterValue,
    statusFilterOptions,
    updateStatusFilterValue,
  } = useAgentRunLogs();

  const enabledAgent = useMemo(() => settings?.agent.enabled, [settings?.agent]);
  const activeLog = useMemo(() => runLogs.find(item => item.key === activeLogKey), [runLogs, activeLogKey]);

  const onRunsUpdated = useCallback((owner_source_id, owner_source_type, runs) => {
    setUpdatedRuns({ owner_source_id, owner_source_type, runs });
  }, []);

  return (
    <>
      <TopBar>
        <div className="seaqa-agent-top-bar-content">
          <div className="w-100 text-truncate">{title}</div>
        </div>
      </TopBar>
      <div className="seaqa-agent-container">
        {!statusFilterValue && runLogs.length === 0 && (
          <>
            {isRunLogsLoading && (
              <CenteredLoading />
            )}
            {!isRunLogsLoading && (
              <EmptyTip
                src={`${mediaUrl}img/no-items-tip.png`}
                title={gettext('No agent logs')}
                text={!enabledAgent && gettext('Enable the agent in settings to start')}
                className="w-100"
              />
            )}
          </>
        )}
        {(runLogs.length > 0 || statusFilterValue) && (
          <>
            <RunLogs
              isShowLogs={isShowLogs}
              runLogs={runLogs}
              isLoading={isRunLogsLoading}
              hasMore={hasMore}
              loadMore={loadMore}
              reload={refresh}
              activeLogKey={activeLogKey}
              updateActiveLogKey={updateActiveLogKey}
              statusFilterValue={statusFilterValue}
              statusFilterOptions={statusFilterOptions}
              updateStatusFilterValue={updateStatusFilterValue}
              hideLogs={() => setIsShowLogs(false)}
              updateRunLog={updateRunLog}
              onRunsUpdated={onRunsUpdated}
            />
            <RunLogDetails
              isShowLogs={isShowLogs}
              showLogs={() => setIsShowLogs(true)}
              hideLogs={() => setIsShowLogs(false)}
              isRunLogsLoading={isRunLogsLoading}
              runLogs={runLogs}
              runLog={activeLog}
              statusFilterValue={statusFilterValue}
              statusFilterOptions={statusFilterOptions}
              settings={settings}
              modifySettings={modifySettings}
              updateRunLog={updateRunLog}
              updatedRuns={updatedRuns}
            />
          </>
        )}
      </div>
    </>
  );
};

export default Agent;
