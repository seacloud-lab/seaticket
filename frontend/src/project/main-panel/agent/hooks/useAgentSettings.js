import { useState, useEffect, useCallback } from 'react';
import { agentAPI } from '@/project/api';
import toaster from '@/components/toaster';
import { gettext } from '@/constants';

const { projectUuid } = window.app.pageOptions;

export const useAgentSettings = () => {
  const [settings, setSettings] = useState({
    agent: {
      enabled: true,
      model: 'gemini-3-flash',
      notify_before_due_hours: 48,
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    agentAPI.getAgentSettings(projectUuid).then(res => {
      const data = res.data;
      setSettings({
        agent: {
          enabled: data.enabled ?? true,
          model: data.model ?? 'gemini-3-flash',
          notify_before_due_hours: data.notify_before_due_hours ?? 48,
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
