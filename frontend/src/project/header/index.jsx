import React, { useMemo } from 'react';
import Account from './account';
import { name, avatarURL, username, PROJECT_ICON_COLORS, PROJECT_ICON_LIST, siteRoot } from '../../constants';
import Icon from '../../components/icon';

import './index.css';

const Header = () => {
  const user = useMemo(() => {
    return {
      name,
      username,
      avatar_url: avatarURL
    };
  }, []);
  const projectName = useMemo(() => window.app.pageOptions.projectName, []);
  const icon = useMemo(() => {
    const info = JSON.parse(window.app.pageOptions.icon);
    return {
      ...info,
      bg_color: info.bg_color || PROJECT_ICON_COLORS[0],
      name: info.name || PROJECT_ICON_LIST[0]
    };
  }, []);

  return (
    <div className="sea-qa-project-header">
      <div className="sea-qa-project-info">
        <a className="sea-qa-project-icon-container" style={{ backgroundColor: icon.bg_color }} href={siteRoot}>
          <i className={`project-icon icon-color-white ${icon.name}`}></i>
          <Icon symbol="return-home" className="sea-qa-project-return-home-icon" />
        </a>
        <span className="sea-qa-project-name">{projectName}</span>
      </div>
      <Account user={user} />
    </div>
  );
};

export default Header;
