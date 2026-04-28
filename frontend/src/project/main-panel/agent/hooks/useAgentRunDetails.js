import { useState, useEffect, useCallback } from 'react';
import { agentAPI } from '@/project/api';
import toaster from '@/components/toaster';
import { gettext } from '@/constants';

const { projectUuid } = window.app.pageOptions;

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
