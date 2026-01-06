import React, { useState, useCallback, useMemo } from 'react';
import { Nav, NavItem, NavLink, TabContent, TabPane } from 'reactstrap';
import { Icon, toaster } from '@/components';
import { gettext } from '@/constants';

import './settings.css';

const { projectUuid } = window.app.pageOptions;

const SETTING_TABS = {
  PORTAL_URL: 'portal_url',
};

const Settings = () => {
  const [activeTab, setActiveTab] = useState(SETTING_TABS.PORTAL_URL);

  const portalUrl = useMemo(() => {
    const { origin } = window.location;
    return `${origin}/portal/${projectUuid}/`;
  }, []);

  const onCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(portalUrl).then(() => {
      toaster.success(gettext('Copied'));
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
        </TabContent>
      </div>
    </>
  );
};

export default Settings;
