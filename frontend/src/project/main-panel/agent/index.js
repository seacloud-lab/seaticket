import React, { useMemo, useState } from 'react';
import TopBar from '../top-bar';
import { useAgentRunLogs } from './hooks/useAgentRunLogs';
import { gettext, mediaUrl } from '@/constants';
import RunLogs from './components/run-logs';
import { EmptyTip, CenteredLoading } from '@/components';
import RunLogDetails from './components/run-log-details';

import './index.css';

const Agent = ({ title, settings, modifySettings }) => {
  const [isShowLogs, setIsShowLogs] = useState(true);
  const [activeLogIndex, setActiveLogIndex] = useState(0);

  const {
    runLogs,
    isLoading: isRunLogsLoading,
    hasMore,
    loadMore,
    refresh,
  } = useAgentRunLogs();

  const enabledAgent = useMemo(() => settings?.agent.enabled, [settings?.agent]);

  return (
    <>
      <TopBar>
        <div className="agent-top-bar-content">
          <div className="w-100 text-truncate">{title}</div>
        </div>
      </TopBar>
      <div className="agent-container">
        {isRunLogsLoading && runLogs.length === 0 && (
          <CenteredLoading />
        )}
        {!isRunLogsLoading && runLogs.length === 0 && (
          <EmptyTip
            src={`${mediaUrl}img/no-items-tip.png`}
            title={gettext('No agent runs')}
            text={!enabledAgent && gettext('Enable the agent in settings to start')}
            className="w-100"
          />
        )}
        {runLogs.length > 0 && (
          <>
            {isShowLogs && (
              <RunLogs
                runLogs={runLogs}
                isLoading={isRunLogsLoading}
                hasMore={hasMore}
                loadMore={loadMore}
                reload={refresh}
                activeLogIndex={activeLogIndex}
                setActiveLogIndex={setActiveLogIndex}
                hideLogs={() => setIsShowLogs(false)}
              />
            )}
            <RunLogDetails
              isShowLogs={isShowLogs}
              showLogs={() => setIsShowLogs(true)}
              runLog={runLogs[activeLogIndex]}
              settings={settings}
              modifySettings={modifySettings}
            />

          </>
        )}
      </div>
    </>
  );
};

export default Agent;
