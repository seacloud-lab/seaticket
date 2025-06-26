import React, { useMemo } from 'react';
import { PROJECT_ICON_COLORS, PROJECT_ICON_LIST, siteRoot } from '../../../constants';
import Icon from '../../../components/icon';

import './index.css';

const Header = () => {

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
    <div className="sea-qa-project-panel-header sea-qa-project-side-panel-header">
      <a className="sea-qa-project-icon" style={{ backgroundColor: icon.bg_color }} href={siteRoot}>
        <i className={`project-icon icon-color-white ${icon.name}`}></i>
        <Icon symbol="return-home" className="sea-qa-project-return-home-icon" />
      </a>
      <span className="sea-qa-project-name" title={projectName} aria-label={projectName}>{projectName}</span>
    </div>
  );
};

export default Header;
