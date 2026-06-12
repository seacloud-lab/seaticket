import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Nav, NavItem, NavLink, TabContent, TabPane, Button } from 'reactstrap';
import copy from 'copy-to-clipboard';
import classnames from 'classnames';
import { Icon, toaster, Switch, PasswordInput } from '@/components';
import { gettext } from '@/constants';
import { portalAPI } from '../../api';
import { connectionsAPI } from '@/project/api/connections-api';
import { Utils } from '@/utils/utils';
import PortalChatSourceSelector from '../chat-source-selector';
import { SETTING_TAB, SETTING_TABS, EMPTY_CHAT_ALLOWED_SOURCES } from './constants';
import { normalizeChatAllowedSources, isConnectionActive } from './utils';
import CustomizationSettings from './customization-settings';
import { getDefaultPortalPublicUrl } from '../../path-utils';

import './index.css';

const { projectUuid, showKBInPortal } = window.app.pageOptions;

const Settings = () => {
  const [activeTab, setActiveTab] = useState(SETTING_TAB.PORTAL_CUSTOMIZATION);

  // anonymous
  const [allowAnonymous, setAllowAnonymous] = useState(false);

  // password
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);

  const [hasLoadedPortalSettings, setHasLoadedPortalSettings] = useState(false);

  // chat
  const [connections, setConnections] = useState([]);
  const [isConnectionsLoading, setIsConnectionsLoading] = useState(true);
  const [chatSettings, setChatSettings] = useState(EMPTY_CHAT_ALLOWED_SOURCES);
  const [serverChatAllowedSources, setServerChatAllowedSources] = useState(null);
  const [isSavingChat, setIsSavingChat] = useState(false);

  // kb
  const [showKB, setShowKB] = useState(showKBInPortal === true);
  const [isSavingKB, setIsSavingKB] = useState(false);
  const [customDomain, setCustomDomain] = useState('');
  const [savedCustomDomain, setSavedCustomDomain] = useState('');
  const [customDomainVerified, setCustomDomainVerified] = useState(false);
  const [customDomainTxtRecordName, setCustomDomainTxtRecordName] = useState('');
  const [customDomainTxtRecordValue, setCustomDomainTxtRecordValue] = useState('');
  const [customDomainDnsTarget, setCustomDomainDnsTarget] = useState('');
  const [isVerifyingCustomDomain, setIsVerifyingCustomDomain] = useState(false);
  const [isSavingCustomDomain, setIsSavingCustomDomain] = useState(false);

  const portalUrl = getDefaultPortalPublicUrl();

  const customDomainUrl = useMemo(() => {
    if (!savedCustomDomain || !customDomainVerified || customDomain !== savedCustomDomain) {
      return '';
    }
    return `${window.location.protocol}//${savedCustomDomain}/`;
  }, [customDomain, customDomainVerified, savedCustomDomain]);

  const applyLoadedSettings = useCallback((data = {}) => {
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
  }, []);

  const applyLoadedCustomDomain = useCallback((data = {}) => {
    setCustomDomain(data.custom_domain || '');
    setSavedCustomDomain(data.custom_domain || '');
    setCustomDomainVerified(!!data.custom_domain_verified);
    setCustomDomainTxtRecordName(data.custom_domain_txt_record_name || '');
    setCustomDomainTxtRecordValue(data.custom_domain_txt_record_value || '');
    setCustomDomainDnsTarget(data.custom_domain_dns_target || '');
  }, []);

  useEffect(() => {
    portalAPI.getSettings(projectUuid).then(res => {
      applyLoadedSettings(res.data || {});
      setHasLoadedPortalSettings(true);
    }).catch(() => {
      setServerChatAllowedSources(null);
      setHasLoadedPortalSettings(true);
    });
  }, [applyLoadedSettings]);

  useEffect(() => {
    portalAPI.getCustomDomain(projectUuid).then(res => {
      applyLoadedCustomDomain(res.data || {});
    }).catch(() => {
      applyLoadedCustomDomain({});
    });
  }, [applyLoadedCustomDomain]);

  useEffect(() => {
    setIsConnectionsLoading(true);
    connectionsAPI.listConnections(projectUuid, 1, 1000).then((res) => {
      setConnections((res.data.records || []).filter(isConnectionActive));
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
      setConnections([]);
    }).finally(() => {
      setIsConnectionsLoading(false);
    });
  }, []);

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

  const onCopyUrl = useCallback((value) => {
    if (!value) return;
    copy(value);
    toaster.success(gettext('Copied'), { duration: 2, hasCloseButton: false });
  }, []);

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

  const onCustomDomainChange = useCallback((event) => {
    setCustomDomain(event.target.value.trim().toLowerCase());
  }, []);

  const onVerifyCustomDomain = useCallback(() => {
    if (!savedCustomDomain || customDomain !== savedCustomDomain || isVerifyingCustomDomain) {
      return;
    }

    setIsVerifyingCustomDomain(true);
    portalAPI.verifyCustomDomain(projectUuid).then(() => {
      return portalAPI.getCustomDomain(projectUuid);
    }).then(res => {
      applyLoadedCustomDomain(res.data || {});
      toaster.success(gettext('Verified'), { duration: 2, hasCloseButton: false });
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
    }).finally(() => {
      setIsVerifyingCustomDomain(false);
    });
  }, [savedCustomDomain, customDomain, isVerifyingCustomDomain, applyLoadedCustomDomain]);

  const onSaveCustomDomain = useCallback(() => {
    if (isSavingCustomDomain) return;

    setIsSavingCustomDomain(true);
    portalAPI.updateCustomDomain(projectUuid, {
      custom_domain: customDomain,
    }).then(() => {
      return portalAPI.getCustomDomain(projectUuid);
    }).then(res => {
      applyLoadedCustomDomain(res.data || {});
      toaster.success(gettext('Saved'), { duration: 2, hasCloseButton: false });
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
    }).finally(() => {
      setIsSavingCustomDomain(false);
    });
  }, [customDomain, isSavingCustomDomain, applyLoadedCustomDomain]);

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
        applyLoadedSettings(res.data || {});
      }).finally(() => {
        toaster.success(gettext('Saved'), { duration: 2, hasCloseButton: false });
        if (shouldSendPassword) {
          setPassword('');
          setConfirmPassword('');
        }
      });
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
    });
  }, [allowAnonymous, enablePassword, password, confirmPassword, isEditingPassword, hasSavedPassword, showKB, applyLoadedSettings]);

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

  const hasUnsavedCustomDomain = customDomain !== savedCustomDomain;
  const canVerifyCustomDomain = !!savedCustomDomain && !hasUnsavedCustomDomain && !customDomainVerified && !isVerifyingCustomDomain;
  const canSaveCustomDomain = hasUnsavedCustomDomain && !isSavingCustomDomain;

  return (
    <>
      <div className="portal-settings-dialog-side dialog-side-nav">
        <Nav pills vertical className="w-100">
          {SETTING_TABS.map(tab => {
            return (
              <NavItem key={tab.value}>
                <NavLink
                  className={activeTab === tab.value ? 'active' : ''}
                  onClick={() => toggle(tab.value)}
                >
                  {tab.label}
                </NavLink>
              </NavItem>
            );
          })}
        </Nav>
      </div>
      <TabContent activeTab={activeTab} className={classnames('portal-settings-dialog-main', activeTab)}>
        <CustomizationSettings />
        <TabPane tabId={SETTING_TAB.OPEN_ACCESS}>
          <div className="portal-settings-content">
            <label className="portal-settings-label">{gettext('Default portal URL')}</label>
            <div className="portal-url-container">
              <input
                type="text"
                className="form-control portal-url-input"
                value={portalUrl}
                readOnly
              />
              <Button color="outline-primary" onClick={() => onCopyUrl(portalUrl)} title={gettext('Copy URL')}>
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
              <Button color="primary" onClick={onSaveSettings}>{gettext('Save')}</Button>
            </div>
          </div>
        </TabPane>
        <TabPane tabId={SETTING_TAB.CUSTOM_DOMAIN}>
          <div className="portal-settings-content">
            <label className="portal-settings-label">{gettext('Custom domain')}</label>
            <input
              type="text"
              className="form-control"
              value={customDomain}
              onChange={onCustomDomainChange}
              placeholder={gettext('support.example.com')}
              spellCheck={false}
              autoComplete="off"
            />
            <p className="portal-settings-help-text mt-2 mb-0">
              {customDomainDnsTarget
                ? gettext('Configure a CNAME or ALIAS record for this domain to the DNS target below.')
                : gettext('After DNS is pointed to the portal ingress, this domain can be used to access the portal.')}
            </p>
            <div className="mt-3">
              <Button color="primary" size="sm" onClick={onSaveCustomDomain} disabled={!canSaveCustomDomain}>
                {isSavingCustomDomain ? gettext('Saving...') : gettext('Save')}
              </Button>
            </div>
            {customDomainDnsTarget && (
              <>
                <label className="portal-settings-label mt-3">{gettext('DNS target')}</label>
                <div className="portal-url-container">
                  <input
                    type="text"
                    className="form-control portal-url-input"
                    value={customDomainDnsTarget}
                    readOnly
                  />
                  <Button color="outline-primary" onClick={() => onCopyUrl(customDomainDnsTarget)} title={gettext('Copy URL')}>
                    <Icon symbol="copy" />
                  </Button>
                </div>
              </>
            )}
            {savedCustomDomain && (
              <>
                <label className="portal-settings-label mt-3">{gettext('Verification status')}</label>
                <div className="d-flex align-items-center gap-2">
                  <span className={customDomainVerified ? 'text-success' : 'text-secondary'}>
                    {customDomainVerified ? gettext('Verified') : gettext('Not verified')}
                  </span>
                  {!customDomainVerified && (
                    <Button
                      color="outline-primary"
                      size="sm"
                      disabled={!canVerifyCustomDomain}
                      onClick={onVerifyCustomDomain}
                    >
                      {isVerifyingCustomDomain ? gettext('Verifying...') : gettext('Verify')}
                    </Button>
                  )}
                </div>
              </>
            )}
            {savedCustomDomain && !customDomainVerified && customDomainTxtRecordName && customDomainTxtRecordValue && (
              <>
                <label className="portal-settings-label mt-3">{gettext('TXT record name')}</label>
                <div className="portal-url-container">
                  <input
                    type="text"
                    className="form-control portal-url-input"
                    value={customDomainTxtRecordName}
                    readOnly
                  />
                  <Button color="outline-primary" onClick={() => onCopyUrl(customDomainTxtRecordName)} title={gettext('Copy URL')}>
                    <Icon symbol="copy" />
                  </Button>
                </div>
                <label className="portal-settings-label mt-3">{gettext('TXT record value')}</label>
                <div className="portal-url-container">
                  <input
                    type="text"
                    className="form-control portal-url-input"
                    value={customDomainTxtRecordValue}
                    readOnly
                  />
                  <Button color="outline-primary" onClick={() => onCopyUrl(customDomainTxtRecordValue)} title={gettext('Copy URL')}>
                    <Icon symbol="copy" />
                  </Button>
                </div>
              </>
            )}
            {hasUnsavedCustomDomain && (
              <p className="portal-settings-help-text mt-2 mb-0">
                {gettext('Save the custom domain before verification.')}
              </p>
            )}
            {customDomainUrl && (
              <>
                <label className="portal-settings-label mt-3">{gettext('Custom domain URL')}</label>
                <div className="portal-url-container">
                  <input
                    type="text"
                    className="form-control portal-url-input"
                    value={customDomainUrl}
                    readOnly
                  />
                  <Button color="outline-primary" onClick={() => onCopyUrl(customDomainUrl)} title={gettext('Copy URL')}>
                    <Icon symbol="copy" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabPane>
        <TabPane tabId={SETTING_TAB.KNOWLEDGE_BASE}>
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
        <TabPane tabId={SETTING_TAB.CHAT}>
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
            <Button
              color="primary"
              className="mt-2"
              onClick={onSaveChatSettings}
              disabled={isSavingChat || isConnectionsLoading || !hasLoadedPortalSettings}
            >
              {gettext('Save')}
            </Button>
          </div>
        </TabPane>
      </TabContent>
    </>
  );
};

export default Settings;
