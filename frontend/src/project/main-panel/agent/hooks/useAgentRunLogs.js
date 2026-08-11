import { useState, useEffect, useCallback, useRef } from 'react';
import { agentAPI } from '@/project/api';
import { toaster } from '@/components';
import { Utils } from '@/utils/utils';

const { projectUuid } = window.app.pageOptions;

export const useAgentRunLogs = () => {
  const [runLogs, setRunLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const pageRef = useRef(1);

  const updateRunLog = useCallback((source_id, source_type, update) => {
    setRunLogs(runLogs => runLogs.map(runLog => {
      if (runLog.source_id === source_id && runLog.source_type === source_type) return { ...runLog, ...update };
      return runLog;
    }));
  }, []);

  const loadRunLogs = useCallback((pageNum = 1) => {
    setIsLoading(true);
    agentAPI.listAgentLogs(projectUuid, pageNum).then(res => {
      const { logs, has_more } = res.data;
      setRunLogs(prev => pageNum === 1 ? logs : [...(prev || []), ...logs]);
      setHasMore(has_more);
      pageRef.current = pageNum;
      setIsLoading(false);
    }).catch(err => {
      console.error('Failed to load agent run logs:', err);
      const errorMessage = Utils.getErrorMsg(err);
      toaster.danger(errorMessage);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    loadRunLogs(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;
    loadRunLogs(pageRef.current + 1);
  }, [isLoading, hasMore, loadRunLogs]);

  const refresh = useCallback(() => {
    setRunLogs([]);
    loadRunLogs(1);
  }, [loadRunLogs]);

  return {
    runLogs,
    isLoading,
    hasMore,
    loadMore,
    refresh,
    updateRunLog,
  };
};
