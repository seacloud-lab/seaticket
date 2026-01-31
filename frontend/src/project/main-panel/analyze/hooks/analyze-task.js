import React, { useContext, useState, useCallback, useRef, useEffect } from 'react';
import { connectionsAPI } from '@/project/api';
import { projectUuid } from '../constants';
import { Utils } from '@/utils/utils';

const AnalyzeTaskContext = React.createContext(null);

export const AnalyzeTaskProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [records, setRecords] = useState(null);
  const [error, setError] = useState(null);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [lastLoadRecordsTime, setLastLoadRecordsTime] = useState('');

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
    if (pollingRef.current) return;
    pollingRef.current = true;

    const poll = () => {
      connectionsAPI.getEmbeddingAnalysisTaskStatus(taskId).then(statusResponse => {
        const { is_finished, records } = statusResponse.data;
        if (is_finished === null) {
          clearPolling();
          setRecords(null);
          setError({ expired: true, message: 'Task expired' });
          setCurrentTaskId(null);
          setIsLoading(false);
          return;
        }
        if (is_finished) {
          clearPolling();
          setRecords(records || []);
          setLastLoadRecordsTime(Date.now());
          setError(null);
          setCurrentTaskId(null);
          setIsLoading(false);
          return;
        }
        pollingTimerRef.current = setTimeout(poll, 2000);
      }).catch(error => {
        const errorMessage = Utils.getErrorMsg(error);
        setError({ message: errorMessage });
        setRecords(null);
        setIsLoading(false);
        clearPolling();
      });
    };

    poll();
  }, [clearPolling]);

  const startAnalysis = useCallback((connectionIds, startDate, endDate) => {
    if (!connectionIds || connectionIds.length === 0) {
      setRecords(null);
      setError(null);
      return;
    }

    clearPolling();
    setIsLoading(true);
    setError(null);

    connectionsAPI.getConnectionsEmbeddingAnalysis( projectUuid, connectionIds, startDate, endDate).then(res => {
      const { task_id } = res.data;
      setCurrentTaskId(task_id);

      pollTaskStatus(task_id);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setRecords(null);
      setError({ message: errorMessage });
      setIsLoading(false);
    });
  }, [clearPolling, pollTaskStatus]);

  const resetAnalysis = useCallback(() => {
    clearPolling();
    setRecords(null);
    setError(null);
    setCurrentTaskId(null);
    setIsLoading(false);
  }, [clearPolling]);

  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, [clearPolling]);

  return (
    <AnalyzeTaskContext.Provider value={{
      isLoading,
      records,
      lastLoadRecordsTime,
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
