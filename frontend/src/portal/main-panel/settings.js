import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Nav, NavItem, NavLink, TabContent, TabPane, Button } from 'reactstrap';
import { Icon, toaster, Switch, PasswordInput, IconButton } from '@/components';
import { gettext } from '@/constants';
import { portalAPI } from '@/portal/api';

import './settings.css';

const { projectUuid } = window.app.pageOptions;

const SETTING_TABS = {
  PORTAL_URL: 'portal_url',
  DISPLAY: 'display',
};

const Settings = () => {
  const [activeTab, setActiveTab] = useState(SETTING_TABS.PORTAL_URL);
  const [allowAnonymous, setAllowAnonymous] = useState(false);
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);

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
    }).catch(() => {});
  }, []);

  const { showKBInPortal } = window.app.pageOptions;
  const [showKB, setShowKB] = useState(showKBInPortal === true);
  const [isSaving, setIsSaving] = useState(false);

  const onToggleKB = useCallback(() => {
    if (isSaving) return;
    const next = !showKB;
    setIsSaving(true);
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
      .finally(() => setIsSaving(false));
  }, [showKB, allowAnonymous, enablePassword, isSaving]);

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
              className={activeTab === SETTING_TABS.DISPLAY ? 'active' : ''}
              onClick={() => toggle(SETTING_TABS.DISPLAY)}
            >
              {gettext('Portal settings')}
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
              <div style={{ marginTop: 16 }}>
                <Switch
                  checked={allowAnonymous}
                  onChange={onToggleAnonymous}
                  placeholder={gettext('Allow anonymous access')}
                  textPosition="right"
                  size="large"
                />
              </div>
              {allowAnonymous && (
                <div style={{ marginTop: 8 }}>
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
                      <label className="portal-settings-label" style={{ marginTop: 8 }}>
                        {gettext('Password (at least 8 characters)')}
                      </label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <PasswordInput
                          value={'********'}
                          onChange={() => {}}
                          disabled={true}
                          enableRandomGeneration={false}
                          enableCheckStrength={false}
                          placeholder={gettext('Enter password')}
                        />
                        <IconButton icon="rename" className="btn btn-outline-secondary p-0" onClick={onEditPassword} />
                      </div>
                    </>
                  )}
                  {(isEditingPassword || !hasSavedPassword) && (
                    <>
                      <label className="portal-settings-label" style={{ marginTop: 8 }}>
                        {gettext('Password (at least 8 characters)')}
                      </label>
                      <PasswordInput
                        value={password}
                        onChange={onPasswordChange}
                        enableRandomGeneration={false}
                        enableCheckStrength={false}
                        placeholder={gettext('Enter password')}
                      />
                      <label className="portal-settings-label" style={{ marginTop: 8 }}>
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
              <div style={{ marginTop: 16 }}>
                <button className="btn btn-primary" onClick={onSaveSettings}>{gettext('Save')}</button>
              </div>
            </div>
          </TabPane>
          <TabPane tabId={SETTING_TABS.DISPLAY}>
            <div className="portal-settings-content">
              <div className="portal-settings-label">
                <Switch
                  checked={showKB}
                  disabled={isSaving}
                  onChange={onToggleKB}
                  textPosition="right"
                  placeholder={gettext('Show knowledge base')}
                  className="portal-settings-switch"
                />
              </div>
            </div>
          </TabPane>
        </TabContent>
      </div>
    </>
  );
};

export default Settings;
