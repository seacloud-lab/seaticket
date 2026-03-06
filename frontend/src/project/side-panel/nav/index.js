import React, { useCallback } from 'react';
import classnames from 'classnames';
import { Icon } from '../../../components';
import { BAR_TYPE } from '../../constants';
import { siteRoot } from '@/constants';
import { NAVIGATION_BASE_PADDING, NAVIGATION_LEVEL_INDENT } from '@/constants';

import './index.css';

const { projectUuid, isProjectAdmin } = window.app.pageOptions;

const Nav = ({ nav, level, activeBar, onClick }) => {
  const { key, name, icon } = nav;
  const isActive = activeBar[0] === key;

  const handleClick = useCallback(() => {
    if (key === BAR_TYPE.SUPPORT_PORTAL) {
      const { origin } = window.location;
      const url = `${origin}${siteRoot}${isProjectAdmin ? 'portal-edit' : 'portal'}/${projectUuid}/`;
      window.open(url);
      return;
    }
    onClick([nav.key]);
  }, [key, onClick, nav.key]);

  return (
    <div
      className={classnames('sea-qa-project-navigation-item', {
        'sea-qa-project-navigation-item-active': isActive,
      })}
      style={{ paddingLeft: level > 1 ? (level - 1) * NAVIGATION_LEVEL_INDENT + NAVIGATION_BASE_PADDING : NAVIGATION_BASE_PADDING }}
      onClick={handleClick}
      title={name}
    >
      {icon && (<Icon symbol={icon} className="sea-qa-project-navigation-item-icon" />)}
      <span className="sea-qa-project-navigation-item-name">{name}</span>
    </div>
  );
};

export default Nav;
