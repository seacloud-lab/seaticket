import React, { useContext, useState, useCallback, useRef, useEffect } from 'react';
import { connectionsAPI } from '@/project/api';
import { TASK_STORAGE_KEY, projectUuid } from '../constants';

const AnalyzeTaskContext = React.createContext(null);

export const AnalyzeTaskProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [records, setRecords] = useState(null);
  const [error, setError] = useState(null);
  const [currentTaskId, setCurrentTaskId] = useState(null);

  const pollingRef = useRef(false);
  const pollingTimerRef = useRef(null);

  const clearPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    pollingRef.current = false;
  }, []);

  const pollTaskStatus = useCallback((taskId) => {
    if (pollingRef.current) {
      return;
    }

    pollingRef.current = true;

    const poll = () => {
      connectionsAPI.getEmbeddingAnalysisTaskStatus(taskId)
        .then(statusResponse => {
          const { is_finished, records: taskRecords } = statusResponse.data;

          if (is_finished === null) {
            localStorage.removeItem(TASK_STORAGE_KEY);
            setIsLoading(false);
            setError({ expired: true, message: 'Task expired' });
            clearPolling();
          } else if (is_finished) {
            localStorage.removeItem(TASK_STORAGE_KEY);
            setRecords(taskRecords);
            setError(null);
            setIsLoading(false);
            setCurrentTaskId(null);
            clearPolling();
          } else {
            pollingTimerRef.current = setTimeout(poll, 2000);
          }
        })
        .catch(err => {
          localStorage.removeItem(TASK_STORAGE_KEY);
          setIsLoading(false);
          setError({ message: err.response?.data?.error_msg || 'Failed to get task status' });
          clearPolling();
        });
    };

    poll();
  }, [clearPolling]);

  const startAnalysis = useCallback(async (connectionIds, startDate, endDate) => {
    if (!connectionIds || connectionIds.length === 0) {
      setRecords(null);
      setError(null);
      return;
    }

    clearPolling();

    setIsLoading(true);
    setError(null);

    try {
      const response = await connectionsAPI.getConnectionsEmbeddingAnalysis(
        projectUuid,
        connectionIds,
        startDate,
        endDate
      );

      const { task_id } = response.data;
      localStorage.setItem(TASK_STORAGE_KEY, task_id);
      setCurrentTaskId(task_id);

      pollTaskStatus(task_id);
    } catch (err) {
      localStorage.removeItem(TASK_STORAGE_KEY);
      setIsLoading(false);
      setRecords(null);
      setError({ message: err.response?.data?.error_msg || 'Failed to start analysis' });
    }
  }, [clearPolling, pollTaskStatus]);

  const resetAnalysis = useCallback(() => {
    clearPolling();
    setRecords(null);
    setError(null);
    setIsLoading(false);
    setCurrentTaskId(null);
    localStorage.removeItem(TASK_STORAGE_KEY);
  }, [clearPolling]);

  useEffect(() => {
    const pendingTaskId = localStorage.getItem(TASK_STORAGE_KEY);
    if (pendingTaskId && !pollingRef.current && !isLoading) {
      setIsLoading(true);
      setCurrentTaskId(pendingTaskId);
      pollTaskStatus(pendingTaskId);
    }
  }, []);

  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, [clearPolling]);

  return (
    <AnalyzeTaskContext.Provider value={{
      isLoading,
      records,
      error,
      currentTaskId,
      startAnalysis,
      resetAnalysis,
    }}>
      {children}
    </AnalyzeTaskContext.Provider>
  );
};

export const useAnalyzeTask = () => {
  const context = useContext(AnalyzeTaskContext);
  if (!context) {
    throw new Error('useAnalyzeTask must be used within AnalyzeTaskProvider');
  }
  return context;
};
