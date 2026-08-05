import { useState, useEffect, useCallback, useRef } from 'react';
import { agentAPI } from '@/project/api';

const { projectUuid } = window.app.pageOptions;

export const useAgentRunLogs = () => {
  const [runLogs, setRunLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const pageRef = useRef(1);

  const loadRunLogs = useCallback((pageNum = 1) => {
    setIsLoading(true);
    agentAPI.testListAgentRunLogs(projectUuid, pageNum).then(res => {
      const { items, has_more } = res.data;
      setRunLogs(prev => pageNum === 1 ? items : [...(prev || []), ...items]);
      setHasMore(has_more);
      pageRef.current = pageNum;
      setIsLoading(false);
    }).catch(err => {
      console.error('Failed to load agent run logs:', err);
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
  };
};
