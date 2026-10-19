import React, { useState } from 'react';
import { EmptyTip, IconButton } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import { PORTAL_PAGE } from '@/portal/constants';
import AppearanceSettings from './appearance-settings';
import CardContentSettings from './card-content-settings';
import HomeContentSettings from './home-content-settings';

import './index.css';

const SETTING_TAB = {
  APPEARANCE: 'appearance',
  CONTENT: 'content',
};

const SETTING_TABS = [
  { value: SETTING_TAB.APPEARANCE, label: gettext('Appearance') },
  { value: SETTING_TAB.CONTENT, label: gettext('Content') },
];

const SettingPanel = ({ homePageStyle, activeCard, setActiveCard, setHomePageStyle, updateHomeSetting, portalName, portalLogo,
  activePage, setPortalName, setPortalLogo, onClose, }) => {
  const [activeTab, setActiveTab] = useState(SETTING_TABS[0].value);

  return (
    <div className="seaqa-portal-settings">
      <div className="seaqa-portal-settings-header">
        <div className="seaqa-portal-settings-title">{gettext('Customize panel')}</div>
        <IconButton
          icon="close"
          onClick={onClose}
          title={gettext('Close')}
          aria-label={gettext('Close')}
        />
      </div>
      <div className="seaqa-portal-settings-tabs" role="tablist">
        {SETTING_TABS.map(tab => (
          <button
            className={`seaqa-portal-settings-tab${activeTab === tab.value ? ' active' : ''}`}
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            role="tab"
            aria-selected={activeTab === tab.value}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="seaqa-portal-settings-content">
        {activeTab === SETTING_TAB.APPEARANCE && (
          <AppearanceSettings
            homePageStyle={homePageStyle}
            setHomePageStyle={setHomePageStyle}
            updateHomeSetting={updateHomeSetting}
            portalName={portalName}
            portalLogo={portalLogo}
            setPortalName={setPortalName}
            setPortalLogo={setPortalLogo}
          />
        )}
        {activePage === PORTAL_PAGE.HOME && activeTab === SETTING_TAB.CONTENT && activeCard && (
          <CardContentSettings
            homePageStyle={homePageStyle}
            activeCard={activeCard}
            setActiveCard={setActiveCard}
            setHomePageStyle={setHomePageStyle}
          />
        )}
        {activePage === PORTAL_PAGE.HOME && activeTab === SETTING_TAB.CONTENT && !activeCard && (
          <HomeContentSettings
            homePageStyle={homePageStyle}
            setHomePageStyle={setHomePageStyle}
            updateHomeSetting={updateHomeSetting}
          />
        )}
        {activePage !== PORTAL_PAGE.HOME && activeTab === SETTING_TAB.CONTENT && (
          <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No customizations available')} />
        )}
      </div>
    </div>
  );
};

export default SettingPanel;
