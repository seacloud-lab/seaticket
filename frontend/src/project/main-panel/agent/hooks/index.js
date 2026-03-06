import { useState, useEffect, useCallback } from 'react';
import { agentAPI } from '@/project/api';
import toaster from '@/components/toaster';
import { gettext } from '@/constants';

const { projectUuid } = window.app.pageOptions;

export const useAgentSettings = () => {
  const [settings, setSettings] = useState({
    agent: {
      enabled: false,
      model: 'gemini-2.5-flash',
      notify_before_due_hours: 48,
      run_interval_hours: 1,
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    agentAPI.getAgentSettings(projectUuid).then(res => {
      const data = res.data;
      setSettings({
        agent: {
          enabled: data.enabled ?? false,
          model: data.model ?? 'gemini-2.5-flash',
          notify_before_due_hours: data.notify_before_due_hours ?? 48,
          run_interval_hours: data.run_interval_hours ?? 1,
        }
      });
      setIsLoading(false);
    }).catch(err => {
      console.error('Failed to load agent settings:', err);
      setIsLoading(false);
    });
  }, []);

  const updateSettings = useCallback((updates, callback) => {
    const prevSettings = settings;
    const currentAgent = settings.agent || {};
    const newAgent = { ...currentAgent, ...updates };
    const newSettings = { agent: newAgent };
    setSettings(newSettings);

    // Send only changed fields so unrelated settings won't be overwritten by stale local defaults.
    agentAPI.updateAgentSettings(projectUuid, updates).then(() => {
      toaster.success(gettext('Settings updated'));
      callback && callback();
    }).catch(err => {
      console.error('Failed to update agent settings:', err);
      toaster.danger(gettext('Failed to update settings'));
      setSettings(prevSettings);
    });
  }, [settings]);

  return {
    settings,
    isLoading,
    updateSettings,
  };
};

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

export const useAgentRunDetails = (runId) => {
  const [runDetails, setRunDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!runId) {
      setRunDetails(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    agentAPI.getAgentRunDetails(projectUuid, runId).then(res => {
      setRunDetails(res.data);
      setIsLoading(false);
    }).catch(err => {
      console.error('Failed to load agent run details:', err);
      setIsLoading(false);
    });
  }, [runId]);

  const confirmAction = useCallback((actionId) => {
    return agentAPI.confirmAgentAction(projectUuid, runId, actionId).then(() => {
      toaster.success(gettext('Action confirmed'));
      // Refresh details
      return agentAPI.getAgentRunDetails(projectUuid, runId).then(res => {
        setRunDetails(res.data);
      });
    }).catch(err => {
      console.error('Failed to confirm action:', err);
      toaster.danger(gettext('Failed to confirm action'));
    });
  }, [runId]);

  const cancelAction = useCallback((actionId) => {
    return agentAPI.cancelAgentAction(projectUuid, runId, actionId).then(() => {
      toaster.success(gettext('Action cancelled'));
      // Refresh details
      return agentAPI.getAgentRunDetails(projectUuid, runId).then(res => {
        setRunDetails(res.data);
      });
    }).catch(err => {
      console.error('Failed to cancel action:', err);
      toaster.danger(gettext('Failed to cancel action'));
    });
  }, [runId]);

  return {
    runDetails,
    isLoading,
    confirmAction,
    cancelAction,
  };
};
