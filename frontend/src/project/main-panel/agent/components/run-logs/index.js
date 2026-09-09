import React, { useCallback, useState, useRef, useEffect } from 'react';
import classnames from 'classnames';
import { CenteredLoading, IconTooltip, ResizeBar, toaster } from '@/components';
import { gettext } from '@/constants';
import { agentAPI } from '@/project/api';
import { RefreshBtn } from '@/project/components';
import ContextMenu from '@/sea-metadata/components/context-menu';
import { isFunction } from '@/utils/type-detection';
import { Utils } from '@/utils/utils';
import { getRunLogStatusByRuns } from '../../utils';
import RunLog from './run-log';

import './index.css';

const INIT_WIDTH = 300;
const { projectUuid } = window.app.pageOptions;

const RunLogs = ({
  runLogs,
  isShowLogs,
  isLoading,
  hasMore,
  loadMore,
  reload,
  activeLogIndex = 0,
  setActiveLogIndex,
  hideLogs,
  updateRunLog,
  onRunsUpdated,
}) => {
  const [left, setLeft] = useState(300);

  const ref = useRef(null);
  const logsRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const contextRunLogRef = useRef(null);

  const handleClick = useCallback((index) => {
    if (index === activeLogIndex) return;
    setActiveLogIndex && setActiveLogIndex(index);
  }, [activeLogIndex, setActiveLogIndex]);

  const handleReload = useCallback(() => {
    setActiveLogIndex(0);
    reload();
  }, [setActiveLogIndex, reload]);

  const onContextMenuCapture = useCallback((event) => {
    const runLogElement = event.target.closest('.seaqa-agent-run-log');
    if (!runLogElement) return;
    const index = Number(runLogElement.dataset.index);
    const runLog = runLogs[index];
    if (!runLog || runLog.status === 'done') {
      contextRunLogRef.current = null;
      return;
    }
    contextRunLogRef.current = runLog;
    handleClick(index);
  }, [handleClick, runLogs]);

  const createContextMenuOptions = useCallback(() => {
    const runLog = contextRunLogRef.current;
    if (!runLog || runLog.status === 'done') return [];

    return [{
      label: gettext('Mark as done'),
      callback: () => {
        const { owner_source_id, owner_source_type } = runLog;
        agentAPI.cancelAgentLogActions(projectUuid, owner_source_type, owner_source_id).then((res) => {
          const runs = res.data?.runs || [];
          updateRunLog(owner_source_id, owner_source_type, { status: getRunLogStatusByRuns(runs) });
          onRunsUpdated(owner_source_id, owner_source_type, runs);
        }).catch((error) => {
          toaster.danger(Utils.getErrorMsg(error));
        });
      },
    }];
  }, [onRunsUpdated, updateRunLog]);

  const onScroll = Utils.debounce(useCallback(() => {
    if (isLoading) return;
    if (!loadMore) return;
    if (!hasMore) return;
    const clientHeight = logsRef.current.clientHeight;
    const scrollHeight = logsRef.current.scrollHeight;
    const scrollTop = logsRef.current.scrollTop;

    const isBottom = (clientHeight + scrollTop + 1) >= scrollHeight;
    if (!isBottom) return;
    loadMore();
  }, [isLoading, hasMore, loadMore]), 100);

  const onResize = useCallback((width) => {
    localStorage.setItem('project_agent_run_logs_width', width - left);
    ref.current.style.width = `${width - left}px`;
  }, [left]);

  useEffect(() => {
    const width = parseFloat(localStorage.getItem('project_agent_run_logs_width') || INIT_WIDTH);
    ref.current.style.width = `${width}px`;
  }, []);

  useEffect(() => {
    const dom = ref.current;
    if (!dom) return;

    try {
      const handleResize = () => {
        if (!dom || !isFunction(dom.getBoundingClientRect)) return;
        const { left } = dom.getBoundingClientRect();
        setLeft(left);
      };

      resizeObserverRef.current = new ResizeObserver(handleResize);
      resizeObserverRef.current.observe(dom);

      handleResize();

      return () => {
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
          resizeObserverRef.current = null;
        }
      };
    } catch (error) {
      const { left } = dom.getBoundingClientRect();
      setLeft(left);
    }
  }, []);

  return (
    <div className={classnames('seaqa-agent-run-logs-container h-100 flex-shrink-0', { 'd-flex': isShowLogs, 'd-none': !isShowLogs })} ref={ref}>
      <div className="seaqa-agent-run-logs w-100 h-100 d-flex flex-column">
        <div className="seaqa-agent-run-logs-header d-flex align-items-center o-hidden pl-4 pr-3 flex-shrink-0">
          <div className="flex-1 d-flex align-items-center o-hidden">
            <div className="font-weight-500 text-truncate">
              {gettext('Run logs')}
            </div>
            <RefreshBtn onClick={handleReload} className="ml-1" />
          </div>
          <IconTooltip
            onClick={hideLogs}
            icon="side-bar"
            tip={gettext('Close the panel')}
            placement="bottom"
            className="mx-0"
            hoverBackground={true}
            size={{ btn: 24, icon: 16 }}
          />
        </div>
        <div className="seaqa-agent-run-logs-body flex-1" onScroll={onScroll} onContextMenuCapture={onContextMenuCapture} ref={logsRef}>
          {runLogs.map((log, index) => {
            const { owner_source_id, owner_source_type } = log;

            return (
              <RunLog
                key={`${owner_source_type}_${owner_source_id}`}
                runLog={log}
                active={index === activeLogIndex}
                index={index}
                onClick={() => handleClick(index)}
              />
            );
          })}
          {isLoading && (
            <CenteredLoading className={classnames({ 'seaqa-agent-run-log-load-more': runLogs.length > 0 })} />
          )}
        </div>
        <ContextMenu
          target={logsRef}
          ignoredTriggerElements={['.seaqa-agent-run-log']}
          createContextMenuOptions={createContextMenuOptions}
        />
      </div>
      <ResizeBar min={left + 300} max={left + 400} onResize={onResize} />
    </div>
  );
};

export default RunLogs;
