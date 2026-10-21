import React, { useCallback } from 'react';
import HeaderBackground from './header-background';
import PortalIdentity from './portal-identity';
import ThemeColor from './theme-color';

import './appearance-settings.css';

const AppearanceSettings = ({ homePageStyle = {}, setHomePageStyle, updateHomeSetting, portalName, portalLogo, portalThemeColor, setPortalName, setPortalLogo, setPortalThemeColor }) => {
  const updateHomePageStyle = useCallback((patch) => {
    setHomePageStyle((prev) => {
      const next = {
        ...prev,
        'portal_home_hero_section': {
          ...prev['portal_home_hero_section'],
          ...patch,
        },
      };
      updateHomeSetting(JSON.stringify(next));
      return next;
    });
  }, [setHomePageStyle, updateHomeSetting]);

  return (
    <aside className="portal-appearance-settings">
      <PortalIdentity
        portalName={portalName}
        portalLogo={portalLogo}
        setPortalName={setPortalName}
        setPortalLogo={setPortalLogo}
      />
      <ThemeColor
        portalThemeColor={portalThemeColor}
        setPortalThemeColor={setPortalThemeColor}
      />
      <HeaderBackground
        homePageStyle={homePageStyle}
        portalThemeColor={portalThemeColor}
        updateHomePageStyle={updateHomePageStyle}
      />
    </aside>
  );
};

export default AppearanceSettings;
