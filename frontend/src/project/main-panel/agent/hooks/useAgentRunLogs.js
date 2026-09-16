import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toaster } from '@/components';
import { gettext } from '@/constants';
import { agentAPI } from '@/project/api';
import { getLoadCount } from '@/utils/load-count';
import { Utils } from '@/utils/utils';
import { LOG_STATUS } from '../constants';

const { projectUuid } = window.app.pageOptions;

export const useAgentRunLogs = () => {
  const [runLogs, setRunLogs] = useState([]);
  const [activeLogKey, updateActiveLogKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [statusFilterValue, setStatusFilterValue] = useState('');

  const localStorageName = useMemo(() => `seaqa-${projectUuid}-agent-status`, []);

  const pageRef = useRef(1);
  const pageCount = useRef(getLoadCount(105));
  const requestControllerRef = useRef(null);
  const statusFilterValueRef = useRef('');
  const cursorRef = useRef(null);

  const statusFilterOptions = useMemo(() => ([
    {
      value: LOG_STATUS.UNPROCESSED,
      label: gettext('Unprocessed'),
    }, {
      value: LOG_STATUS.PROCESSED,
      label: gettext('Processed'),
    }
  ]), []);

  const loadRunLogs = useCallback((pageNum = 1) => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setIsLoading(true);
    agentAPI.listAgentLogs(projectUuid, pageNum, pageCount.current, statusFilterValueRef.current, cursorRef.current, controller.signal).then(res => {
      if (controller.signal.aborted) return;
      const { logs, has_more, next_cursor } = res.data;
      const validLogs = Array.isArray(logs) ? logs.map(item => ({ ...item, key: `${item.owner_source_type}_${item.owner_source_id}` })) : [];
      setRunLogs(prev => {
        const oldLogs = [...(prev || [])];
        const logs = pageNum === 1 ? validLogs : [...oldLogs, ...validLogs];
        if (oldLogs.length === 0) {
          const firstLog = logs[0] || { key: '' };
          updateActiveLogKey(firstLog.key);
        }
        return logs;
      });
      setHasMore(has_more);
      cursorRef.current = next_cursor;
      pageRef.current = pageNum;
      setIsLoading(false);
    }).catch(err => {
      if (controller.signal.aborted) return;
      // eslint-disable-next-line no-console
      console.error('Failed to load agent run logs:', err);
      const errorMessage = Utils.getErrorMsg(err);
      toaster.danger(errorMessage);
      setIsLoading(false);
    });
  }, []);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;
    loadRunLogs(pageRef.current + 1);
  }, [isLoading, hasMore, loadRunLogs]);

  const refresh = useCallback(() => {
    cursorRef.current = null;
    setRunLogs([]);
    loadRunLogs(1);
  }, [loadRunLogs]);

  const updateStatusFilterValue = useCallback((value) => {
    cursorRef.current = null;
    statusFilterValueRef.current = value;
    setStatusFilterValue(value);
    localStorage.setItem(localStorageName, value);
    refresh();
  }, [localStorageName, refresh]);

  const updateRunLog = useCallback((owner_source_id, owner_source_type, update) => {
    setRunLogs(runLogs => {
      let newRunLogs = runLogs.map(runLog => {
        if (
          runLog.owner_source_id === owner_source_id &&
          runLog.owner_source_type === owner_source_type
        ) {
          return { ...runLog, ...update };
        }
        return runLog;
      });
      if (!statusFilterValueRef.current) return newRunLogs;
      const runLogIndex = newRunLogs.findIndex(item => item.key === `${owner_source_type}_${owner_source_id}`);
      if (runLogIndex === -1) return newRunLogs;
      const runLog = newRunLogs[runLogIndex];
      if ((statusFilterValueRef.current === LOG_STATUS.PROCESSED && runLog.status !== LOG_STATUS.PROCESSED) ||
        statusFilterValueRef.current !== LOG_STATUS.PROCESSED && runLog.status === LOG_STATUS.PROCESSED) {
        const nextLog = newRunLogs[runLogIndex + 1] || newRunLogs[runLogIndex - 1] || { key: '' };
        updateActiveLogKey(nextLog.key);
        newRunLogs.splice(runLogIndex, 1);
        cursorRef.current = cursorRef.current - 1;
        if (newRunLogs.length < pageCount.current) {
          loadMore();
        }
      }
      return newRunLogs;
    });
  }, [loadMore]);

  useEffect(() => {
    const statusFilterValue = localStorage.getItem(localStorageName, '');
    setStatusFilterValue(statusFilterValue);
    statusFilterValueRef.current = statusFilterValue;
    loadRunLogs(1);
    return () => requestControllerRef.current?.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadRunLogs]);

  return {
    runLogs,
    isLoading,
    hasMore,
    loadMore,
    refresh,
    updateRunLog,
    activeLogKey,
    updateActiveLogKey,
    statusFilterValue,
    statusFilterOptions,
    updateStatusFilterValue,
  };
};
