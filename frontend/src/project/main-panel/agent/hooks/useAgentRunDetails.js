import { useState, useEffect, useCallback } from 'react';
import { agentAPI } from '@/project/api';
import toaster from '@/components/toaster';
import { gettext } from '@/constants';

const { projectUuid } = window.app.pageOptions;

export const useAgentRunDetails = (runId) => {
  const [runDetails, setRunDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingMapping, setPendingMapping] = useState(null);

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
      const payload = err?.response?.data;
      if (payload?.error_code === 'mapping_required') {
        setPendingMapping({
          actionId,
          agentType: payload.agent_type,
          githubIssueTypes: payload.github_issue_types || [],
        });
        return;
      }
      console.error('Failed to confirm action:', err);
      toaster.danger(gettext('Failed to confirm action'));
    });
  }, [runId]);

  const dismissMapping = useCallback(() => {
    setPendingMapping(null);
  }, []);

  const submitMappingAndRetry = useCallback((selectedGithubType) => {
    if (!pendingMapping?.agentType || !pendingMapping?.actionId) {
      return Promise.resolve();
    }

    const agentType = pendingMapping.agentType;
    const actionId = pendingMapping.actionId;
    return agentAPI.getAgentSettings(projectUuid).then((res) => {
      const existingMapping = res?.data?.github_issue_type_mapping || {};
      return agentAPI.updateAgentSettings(projectUuid, {
        github_issue_type_mapping: {
          ...existingMapping,
          [agentType]: selectedGithubType,
        },
      });
    }).then(() => {
      setPendingMapping(null);
      return agentAPI.confirmAgentAction(projectUuid, runId, actionId);
    }).then(() => {
      toaster.success(gettext('Action confirmed'));
      return agentAPI.getAgentRunDetails(projectUuid, runId).then(res => {
        setRunDetails(res.data);
      });
    }).catch((err) => {
      console.error('Failed to save mapping and confirm action:', err);
      toaster.danger(gettext('Failed to confirm action'));
      throw err;
    });
  }, [pendingMapping, runId]);

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
    pendingMapping,
    confirmAction,
    cancelAction,
    dismissMapping,
    submitMappingAndRetry,
  };
};
