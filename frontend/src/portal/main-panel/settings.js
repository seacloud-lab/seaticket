import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Nav, NavItem, NavLink, TabContent, TabPane, Button } from 'reactstrap';
import { Icon, toaster, Switch, PasswordInput } from '@/components';
import { gettext } from '@/constants';
import { portalAPI } from '../api';
import { connectionsAPI } from '@/project/api/connections-api';
import { Utils } from '@/utils/utils';
import PortalChatSourceSelector from './chat-source-selector';

import './settings.css';

const { projectUuid } = window.app.pageOptions;

const SETTING_TABS = {
  PORTAL_URL: 'portal_url',
  KNOWLEDGE_BASE: 'knowledge_base',
  CHAT: 'chat',
};

const CHAT_EXTRA_SOURCES = ['knowledge_base', 'ticket'];
const EMPTY_CHAT_ALLOWED_SOURCES = { connection_ids: [], extra_sources: [] };

const normalizeExtraSources = (extraSources = []) => {
  if (!Array.isArray(extraSources)) return [];
  return CHAT_EXTRA_SOURCES.filter((source) => extraSources.includes(source));
};

const normalizeChatAllowedSources = (rawChatAllowedSources, connections = []) => {
  if (!rawChatAllowedSources || Array.isArray(rawChatAllowedSources) || typeof rawChatAllowedSources !== 'object') {
    return EMPTY_CHAT_ALLOWED_SOURCES;
  }

  const rawConnectionIds = Array.isArray(rawChatAllowedSources.connection_ids) ? rawChatAllowedSources.connection_ids : [];
  const extraSources = normalizeExtraSources(rawChatAllowedSources.extra_sources);

  const rawConnectionIdSet = new Set(rawConnectionIds.map(String));
  return {
    connection_ids: connections
      .filter((connection) => rawConnectionIdSet.has(String(connection.id)))
      .map((connection) => connection.id),
    extra_sources: extraSources,
  };
};

const Settings = () => {
  const [activeTab, setActiveTab] = useState(SETTING_TABS.PORTAL_URL);
  const [allowAnonymous, setAllowAnonymous] = useState(false);
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [connections, setConnections] = useState([]);
  const [isConnectionsLoading, setIsConnectionsLoading] = useState(true);
  const [chatSettings, setChatSettings] = useState(EMPTY_CHAT_ALLOWED_SOURCES);
  const [serverChatAllowedSources, setServerChatAllowedSources] = useState(null);
  const [hasLoadedPortalSettings, setHasLoadedPortalSettings] = useState(false);
  const [isSavingChat, setIsSavingChat] = useState(false);

  const portalUrl = useMemo(() => {
    const { origin } = window.location;
    return `${origin}/portal/${projectUuid}/`;
  }, []);

  useEffect(() => {
    portalAPI.getSettings(projectUuid).then(res => {
      const data = res.data || {};
      setAllowAnonymous(!!data.allow_anonymous);
      setEnablePassword(!!data.enable_password_protection);
      setHasSavedPassword(!!data.enable_password_protection);
      setIsEditingPassword(false);

      const kbEnabled = data.show_knowledge_base ?? data.show_kb_in_portal;
      if (typeof kbEnabled !== 'undefined') {
        setShowKB(!!kbEnabled);
        window.app.pageOptions.showKBInPortal = !!kbEnabled;
      }

      setServerChatAllowedSources(data.chat_allowed_sources || null);
      setHasLoadedPortalSettings(true);
    }).catch(() => {
      setServerChatAllowedSources(null);
      setHasLoadedPortalSettings(true);
    });
  }, []);

  useEffect(() => {
    setIsConnectionsLoading(true);
    connectionsAPI.listConnections(projectUuid, 1, 1000).then((res) => {
      setConnections(res.data.records || []);
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
      setConnections([]);
    }).finally(() => {
      setIsConnectionsLoading(false);
    });
  }, []);

  const { showKBInPortal } = window.app.pageOptions;
  const [showKB, setShowKB] = useState(showKBInPortal === true);
  const [isSavingKB, setIsSavingKB] = useState(false);

  useEffect(() => {
    if (!hasLoadedPortalSettings || isConnectionsLoading) {
      return;
    }

    setChatSettings(normalizeChatAllowedSources(serverChatAllowedSources, connections));
  }, [connections, hasLoadedPortalSettings, isConnectionsLoading, serverChatAllowedSources]);

  const onToggleKB = useCallback(() => {
    if (isSavingKB) return;
    const next = !showKB;
    setIsSavingKB(true);
    setShowKB(next);
    const needPwd = allowAnonymous && enablePassword;
    portalAPI.updateSettings(projectUuid, {
      allow_anonymous: allowAnonymous ? 1 : 0,
      enable_password_protection: needPwd ? 1 : 0,
      password: '',
      show_knowledge_base: next ? 1 : 0,
    })
      .then(() => {
        window.app.pageOptions.showKBInPortal = next;
        window.dispatchEvent(new CustomEvent('portal:kb-visibility', { detail: { enabled: next } }));
      })
      .catch(() => {
        setShowKB(!next);
        toaster.danger(gettext('Save failed'));
      })
      .finally(() => setIsSavingKB(false));
  }, [showKB, allowAnonymous, enablePassword, isSavingKB]);

  const onCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(portalUrl).then(() => {
      toaster.success(gettext('Copied'), { duration: 2, hasCloseButton: false });
    });
  }, [portalUrl]);

  const toggle = useCallback((tab) => {
    if (activeTab !== tab) {
      setActiveTab(tab);
    }
  }, [activeTab]);

  const onToggleAnonymous = useCallback(() => {
    setAllowAnonymous(prev => !prev);
  }, []);

  const onTogglePassword = useCallback(() => {
    setEnablePassword(prev => {
      const next = !prev;
      if (next) {
        setIsEditingPassword(true);
        setHasSavedPassword(false);
      } else {
        setIsEditingPassword(false);
        setHasSavedPassword(false);
        setPassword('');
        setConfirmPassword('');
      }
      return next;
    });
  }, []);

  const onPasswordChange = useCallback((val) => {
    setPassword(val);
  }, []);

  const onConfirmPasswordChange = useCallback((val) => {
    setConfirmPassword(val);
  }, []);

  const onEditPassword = useCallback(() => {
    setIsEditingPassword(true);
  }, []);

  const onSaveSettings = useCallback(() => {
    const needPwd = allowAnonymous && enablePassword;
    const shouldSendPassword = needPwd && (isEditingPassword || !hasSavedPassword);
    if (shouldSendPassword) {
      if (!password || password.length < 8) {
        toaster.danger(gettext('Password must be at least 8 characters'), { duration: 2, hasCloseButton: false });
        return;
      }
      if (confirmPassword !== password) {
        toaster.danger(gettext('Passwords do not match'), { duration: 2, hasCloseButton: false });
        return;
      }
    }
    const payload = {
      allow_anonymous: allowAnonymous ? 1 : 0,
      enable_password_protection: needPwd ? 1 : 0,
      password: shouldSendPassword ? password : '',
      show_knowledge_base: showKB ? 1 : 0,
    };
    portalAPI.updateSettings(projectUuid, payload).then(() => {
      portalAPI.getSettings(projectUuid).then(res => {
        const data = res.data || {};
        setAllowAnonymous(!!data.allow_anonymous);
        setEnablePassword(!!data.enable_password_protection);
        setHasSavedPassword(!!data.enable_password_protection);
        setIsEditingPassword(false);
      }).finally(() => {
        toaster.success(gettext('Saved'), { duration: 2, hasCloseButton: false });
        if (shouldSendPassword) {
          setPassword('');
          setConfirmPassword('');
        }
      });
    }).catch(() => {
      toaster.danger(gettext('Save failed'), { duration: 2, hasCloseButton: false });
    });
  }, [allowAnonymous, enablePassword, password, confirmPassword, isEditingPassword, hasSavedPassword, showKB]);

  const handleSourceChange = useCallback((value) => {
    setChatSettings(value);
  }, []);

  const onSaveChatSettings = useCallback(() => {
    setIsSavingChat(true);
    const nextChatAllowedSources = {
      connection_ids: chatSettings.connection_ids,
      extra_sources: chatSettings.extra_sources,
    };

    portalAPI.updateSettings(projectUuid, {
      chat_allowed_sources: nextChatAllowedSources,
    }).then(() => {
      setServerChatAllowedSources(nextChatAllowedSources);
      toaster.success(gettext('Saved'), { duration: 2, hasCloseButton: false });
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    }).finally(() => {
      setIsSavingChat(false);
    });
  }, [chatSettings]);

  return (
    <>
      <div className="portal-settings-dialog-side dialog-side-nav">
        <Nav pills vertical className="w-100">
          <NavItem>
            <NavLink
              className={activeTab === SETTING_TABS.PORTAL_URL ? 'active' : ''}
              onClick={() => toggle(SETTING_TABS.PORTAL_URL)}
            >
              {gettext('Open access')}
            </NavLink>
          </NavItem>
          <NavItem>
            <NavLink
              className={`${activeTab === SETTING_TABS.KNOWLEDGE_BASE ? 'active' : ''}`}
              onClick={() => toggle(SETTING_TABS.KNOWLEDGE_BASE)}
            >
              {gettext('Knowledge base')}
            </NavLink>
          </NavItem>
          <NavItem>
            <NavLink
              className={`${activeTab === SETTING_TABS.CHAT ? 'active' : ''}`}
              onClick={() => toggle(SETTING_TABS.CHAT)}
            >
              {gettext('Chat')}
            </NavLink>
          </NavItem>
        </Nav>
      </div>
      <div className="portal-settings-dialog-main">
        <TabContent activeTab={activeTab}>
          <TabPane tabId={SETTING_TABS.PORTAL_URL}>
            <div className="portal-settings-content">
              <label className="portal-settings-label">{gettext('Portal URL')}</label>
              <div className="portal-url-container">
                <input
                  type="text"
                  className="form-control portal-url-input"
                  value={portalUrl}
                  readOnly
                />
                <Button color="outline-primary" onClick={onCopyUrl} title={gettext('Copy URL')}>
                  <Icon symbol="copy" />
                </Button>
              </div>
              <div className="mt-4">
                <Switch
                  checked={allowAnonymous}
                  onChange={onToggleAnonymous}
                  placeholder={gettext('Allow anonymous access')}
                  textPosition="right"
                  size="large"
                />
              </div>
              {allowAnonymous && (
                <div className="mt-2">
                  <Switch
                    checked={enablePassword}
                    onChange={onTogglePassword}
                    placeholder={gettext('Enable password protection')}
                    textPosition="right"
                    size="large"
                  />
                </div>
              )}
              {allowAnonymous && enablePassword && (
                <>
                  {!isEditingPassword && hasSavedPassword && (
                    <>
                      <label className="portal-settings-label mt-2">
                        {gettext('Password (at least 8 characters)')}
                      </label>
                      <div className="d-flex gap-2 align-items-center">
                        <PasswordInput
                          value={'********'}
                          onChange={() => { }}
                          disabled={true}
                          enableRandomGeneration={false}
                          enableCheckStrength={false}
                          placeholder={gettext('Enter password')}
                        />
                        <Button color="outline-primary" onClick={onEditPassword} title={gettext('Replace password')}>
                          <Icon symbol="rename" />
                        </Button>
                      </div>
                    </>
                  )}
                  {(isEditingPassword || !hasSavedPassword) && (
                    <>
                      <label className="portal-settings-label mt-2">
                        {gettext('Password (at least 8 characters)')}
                      </label>
                      <PasswordInput
                        value={password}
                        onChange={onPasswordChange}
                        enableRandomGeneration={false}
                        enableCheckStrength={false}
                        placeholder={gettext('Enter password')}
                      />
                      <label className="portal-settings-label mt-2">
                        {gettext('Confirm password')}
                      </label>
                      <PasswordInput
                        value={confirmPassword}
                        onChange={onConfirmPasswordChange}
                        enableRandomGeneration={false}
                        enableCheckStrength={false}
                        placeholder={gettext('Re-enter password')}
                      />
                    </>
                  )}
                </>
              )}
              <div className="mt-4">
                <button className="btn btn-primary" onClick={onSaveSettings}>{gettext('Save')}</button>
              </div>
            </div>
          </TabPane>
          <TabPane tabId={SETTING_TABS.KNOWLEDGE_BASE}>
            <div className="portal-settings-content">
              <label className="portal-settings-label">{gettext('Display')}</label>
              <Switch
                checked={showKB}
                disabled={isSavingKB}
                onChange={onToggleKB}
                textPosition="right"
                placeholder={gettext('Show knowledge base')}
                className="portal-settings-switch"
              />
            </div>
          </TabPane>
          <TabPane tabId={SETTING_TABS.CHAT}>
            <div className="portal-settings-content">
              <label className="portal-settings-label">{gettext('Chat sources')}</label>
              <p className="portal-settings-help-text">
                {gettext('Select which data sources can be used for AI responses in the portal.')}
              </p>
              <div className="portal-settings-source-selector-wrapper">
                <PortalChatSourceSelector
                  connections={connections}
                  value={chatSettings}
                  disabled={isSavingChat || isConnectionsLoading || !hasLoadedPortalSettings}
                  onChange={handleSourceChange}
                />
              </div>
              <button
                className="btn btn-primary mt-2"
                onClick={onSaveChatSettings}
                disabled={isSavingChat || isConnectionsLoading || !hasLoadedPortalSettings}
              >
                {gettext('Save')}
              </button>
            </div>
          </TabPane>
        </TabContent>
      </div>
    </>
  );
};

export default Settings;
