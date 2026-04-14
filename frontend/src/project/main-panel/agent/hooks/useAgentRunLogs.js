import { useState, useEffect, useCallback } from 'react';
import { agentAPI } from '@/project/api';

const { projectUuid } = window.app.pageOptions;

export const useAgentRunLogs = () => {
  const [runLogs, setRunLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadRunLogs = useCallback((pageNum = 1, append = false) => {
    setIsLoading(true);
    agentAPI.listAgentRunLogs(projectUuid, pageNum).then(res => {
      const { runs, has_more } = res.data;
      if (append) {
        setRunLogs(prev => [...prev, ...runs]);
      } else {
        setRunLogs(runs);
      }
      setHasMore(has_more);
      setPage(pageNum);
      setIsLoading(false);
    }).catch(err => {
      console.error('Failed to load agent run logs:', err);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    loadRunLogs(1);
  }, [loadRunLogs]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadRunLogs(page + 1, true);
    }
  }, [isLoading, hasMore, page, loadRunLogs]);

  const refresh = useCallback(() => {
    setRunLogs([]);
    loadRunLogs(1);
  }, [loadRunLogs]);

  const updateRunLog = useCallback((runId) => {
    return agentAPI.getAgentRunDetails(projectUuid, runId).then(res => {
      setRunLogs(prev => prev.map(run => run.id === runId ? res.data : run));
    }).catch(err => {
      console.error('Failed to refresh run log:', err);
    });
  }, []);

  return {
    runLogs,
    isLoading,
    hasMore,
    loadMore,
    refresh,
    updateRunLog,
  };
};
