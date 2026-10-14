import React, { useCallback, useContext, useEffect, useRef, useState, useMemo } from 'react';
import { toaster } from '@/components';
import { gettext } from '@/constants';
import { portalAPI } from '@/portal/api';
import {
  PORTAL_DEFAULT_SETTINGS,
  PORTAL_DOMAIN_ALIAS_DEFAULT_SETTINGS,
  PORTAL_CUSTOM_DOMAIN_DEFAULT_SETTINGS,
} from '@/project/constants';
import { isBoolean } from '@/utils/type-detection';
import { Utils } from '@/utils/utils';
import { useConnections } from '../connections/hooks';
import { isConnectionActive } from './utils';

const PortalSettingsContext = React.createContext(null);

export const PortalSettingsProvider = ({ projectUuid, isActive, children }) => {
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [isDomainAliasSettingsLoading, setIsDomainAliasSettingsLoading] = useState(true);
  const [isCustomDomainSettingsLoading, setIsCustomDomainSettingsLoading] = useState(true);
  const [settings, setSettings] = useState({ ...PORTAL_DEFAULT_SETTINGS });
  const [domainAliasSettings, setDomainAliasSettings] = useState({ ...PORTAL_DOMAIN_ALIAS_DEFAULT_SETTINGS });
  const [customDomainSettings, setCustomDomainSettings] = useState({ ...PORTAL_CUSTOM_DOMAIN_DEFAULT_SETTINGS });

  const settingsLoadController = useRef(null);
  const domainAliasLoadController = useRef(null);
  const customDomainLoadController = useRef(null);

  const domainAliasSaveController = useRef(null);
  const customDomainSaveController = useRef(null);

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  // chat
  const { isLoading: isConnectionsLoading, connections: allConnections } = useConnections();
  const connections = useMemo(() => allConnections.filter(isConnectionActive), [allConnections]);

  const updateSettings = useCallback((update = {}, callback) => {
    let serverData = {};
    Object.keys(update).forEach(key => {
      const value = update[key];
      if (isBoolean(value)) {
        serverData[key] = value ? 1 : 0;
      } else {
        serverData[key] = value;
      }
    });
    setSettings(currentSettings => ({ ...currentSettings, ...update }));
    portalAPI.updateSettings(projectUuid, serverData).then(res => {
      callback && callback(true);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(false);
    });
  }, [projectUuid]);

  const updateLogo = useCallback((file, callback) => {
    return portalAPI.uploadPortalLogo(projectUuid, file).then(res => {
      const newLogo = res.data?.file_url || res.data?.url || '';
      if (!newLogo) throw new Error(gettext('Error'));
      return updateSettings({ portal_logo: newLogo }).then(isSuccess => {
        callback && callback(isSuccess ? newLogo : false);
        return isSuccess;
      });
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(false);
      return false;
    });
  }, [projectUuid, updateSettings]);

  const reloadDomainAliasSettings = useCallback((callback) => {
    if (!isActiveRef.current) return;
    domainAliasLoadController.current?.abort();
    const controller = new AbortController();
    domainAliasLoadController.current = controller;

    portalAPI.getDomainAlias(projectUuid, controller.signal).then(res => {
      if (controller.signal.aborted || !isActiveRef.current) return;
      const value = { ...PORTAL_DOMAIN_ALIAS_DEFAULT_SETTINGS, ...(res?.data || {}) };
      setDomainAliasSettings(value);
    }).catch(error => {
      if (controller.signal.aborted || !isActiveRef.current) return;
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    }).finally(() => {
      if (domainAliasLoadController.current !== controller) return;
      domainAliasLoadController.current = null;
      if (!controller.signal.aborted && isActiveRef.current) callback && callback();
    });
  }, [projectUuid]);

  const reloadCustomDomainSettings = useCallback((callback) => {
    if (!isActiveRef.current) return;
    customDomainLoadController.current?.abort();
    const controller = new AbortController();
    customDomainLoadController.current = controller;

    portalAPI.getCustomDomain(projectUuid, controller.signal).then(res => {
      if (controller.signal.aborted || !isActiveRef.current) return;
      const value = { ...PORTAL_CUSTOM_DOMAIN_DEFAULT_SETTINGS, ...(res?.data || {}) };
      setCustomDomainSettings(value);
    }).catch(error => {
      if (controller.signal.aborted || !isActiveRef.current) return;
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    }).finally(() => {
      if (customDomainLoadController.current !== controller) return;
      customDomainLoadController.current = null;
      if (!controller.signal.aborted && isActiveRef.current) callback && callback();
    });
  }, [projectUuid]);

  const updateDomainAliasSettings = useCallback((update, callback) => {
    domainAliasSaveController.current?.abort();
    const controller = new AbortController();
    domainAliasSaveController.current = controller;

    portalAPI.updateDomainAlias(projectUuid, update, controller.signal).then(() => {
      if (controller.signal.aborted) return;
      callback && callback();
      reloadDomainAliasSettings();
      reloadCustomDomainSettings();
    }).catch(error => {
      if (controller.signal.aborted) return;
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(false);
    }).finally(() => {
      if (domainAliasSaveController.current === controller) {
        domainAliasSaveController.current = null;
      }
    });
  }, [projectUuid, reloadDomainAliasSettings, reloadCustomDomainSettings]);

  const updateCustomDomainSettings = useCallback((update, callback) => {
    customDomainSaveController.current?.abort();
    const controller = new AbortController();
    customDomainSaveController.current = controller;

    portalAPI.updateCustomDomain(projectUuid, update, controller.signal).then(() => {
      if (controller.signal.aborted) return;
      callback && callback();
      reloadCustomDomainSettings();
    }).catch((error) => {
      if (controller.signal.aborted) return;
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(false);
    }).finally(() => {
      if (customDomainSaveController.current === controller) {
        customDomainSaveController.current = null;
      }
    });
  }, [projectUuid, reloadCustomDomainSettings]);

  const createPreviewToken = useCallback(() => {
    return portalAPI.createPreviewToken(projectUuid);
  }, [projectUuid]);

  const verifyCustomDomain = useCallback(() => {
    return portalAPI.verifyCustomDomain(projectUuid).then(res => {
      if (isActiveRef.current) reloadCustomDomainSettings();
      return res;
    });
  }, [projectUuid, reloadCustomDomainSettings]);

  useEffect(() => {
    if (!isActive) return;

    settingsLoadController.current?.abort();
    const controller = new AbortController();
    settingsLoadController.current = controller;
    setIsSettingsLoading(true);
    setIsDomainAliasSettingsLoading(true);
    setIsCustomDomainSettingsLoading(true);
    portalAPI.getSettings(projectUuid, controller.signal).then(res => {
      if (controller.signal.aborted) return;
      const newSettings = { ...PORTAL_DEFAULT_SETTINGS, ...(res?.data || {}) };
      if (!newSettings.portal_logo) {
        newSettings.portal_logo = PORTAL_DEFAULT_SETTINGS.portal_logo;
      }
      if (!newSettings.portal_name) {
        newSettings.portal_name = PORTAL_DEFAULT_SETTINGS.portal_name;
      }
      setSettings(newSettings);
    }).catch(error => {
      if (controller.signal.aborted) return;
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    }).finally(() => {
      if (settingsLoadController.current !== controller) return;
      settingsLoadController.current = null;
      setIsSettingsLoading(false);
    });

    reloadDomainAliasSettings(() => setIsDomainAliasSettingsLoading(false));
    reloadCustomDomainSettings(() => setIsCustomDomainSettingsLoading(false));

    return () => {
      if (settingsLoadController.current === controller) {
        settingsLoadController.current = null;
      }
      controller.abort();
      domainAliasLoadController.current?.abort();
      domainAliasLoadController.current = null;
      customDomainLoadController.current?.abort();
      customDomainLoadController.current = null;
    };
  }, [projectUuid, isActive, reloadDomainAliasSettings, reloadCustomDomainSettings]);

  return (
    <PortalSettingsContext.Provider value={{
      isLoading: isSettingsLoading || isDomainAliasSettingsLoading || isCustomDomainSettingsLoading || isConnectionsLoading,
      connections,

      settings,
      updateSettings,
      updateLogo,

      domainAliasSettings,
      updateDomainAliasSettings,
      createPreviewToken,

      customDomainSettings,
      updateCustomDomainSettings,
      verifyCustomDomain,
    }}>
      {children}
    </PortalSettingsContext.Provider>
  );
};

export const usePortalSettings = () => {
  const context = useContext(PortalSettingsContext);
  if (!context) {
    throw new Error('\'PortalSettingsContext\' is null');
  }
  return context;
};
