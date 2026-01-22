import React, { useState, useCallback, useMemo } from 'react';
import { Nav, NavItem, NavLink, TabContent, TabPane } from 'reactstrap';
import { Icon, toaster, Switch } from '@/components';
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

  const portalUrl = useMemo(() => {
    const { origin } = window.location;
    return `${origin}/portal/${projectUuid}/`;
  }, []);

  const { workspaceId, projectName, showKBInPortal } = window.app.pageOptions;
  const [showKB, setShowKB] = useState(showKBInPortal === true);
  const [isSaving, setIsSaving] = useState(false);

  const onToggleKB = useCallback(() => {
    if (isSaving) return;
    const next = !showKB;
    setIsSaving(true);
    setShowKB(next);
    portalAPI.updateProjectSettings(workspaceId, projectName, { portal_show_knowledge_base: next })
      .then(() => {
        window.app.pageOptions.showKBInPortal = next;
        window.dispatchEvent(new CustomEvent('portal:kb-visibility', { detail: { enabled: next } }));
      })
      .catch(() => {
        setShowKB(!next);
        toaster.danger(gettext('Save failed'));
      })
      .finally(() => setIsSaving(false));
  }, [showKB, workspaceId, projectName, isSaving]);

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

  return (
    <>
      <div className="portal-settings-dialog-side dialog-side-nav">
        <Nav pills vertical className="w-100">
          <NavItem>
            <NavLink
              className={activeTab === SETTING_TABS.PORTAL_URL ? 'active' : ''}
              onClick={() => toggle(SETTING_TABS.PORTAL_URL)}
            >
              {gettext('Portal URL')}
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
                <button
                  className="btn btn-outline-primary portal-copy-btn"
                  onClick={onCopyUrl}
                  title={gettext('Copy URL')}
                >
                  <Icon symbol="copy" />
                </button>
              </div>
            </div>
          </TabPane>
          <TabPane tabId={SETTING_TABS.DISPLAY}>
            <div className="portal-settings-content">
              <label className="portal-settings-label">{gettext('Display knowledge base')}</label>
              <div className="d-flex align-items-center">
                <Switch
                  checked={showKB}
                  disabled={isSaving}
                  onChange={onToggleKB}
                  placeholder={showKB ? gettext('On') : gettext('Off')}
                  textPosition="right"
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
