import React from 'react';
import classnames from 'classnames';
import { Icon } from '../../../components';

import './index.css';

const Nav = ({ nav, level, activeBar, onClick }) => {
  const { key, name, icon } = nav;
  const isActive = activeBar[0] === key;

  return (
    <div
      className={classnames('sea-qa-project-navigation-item', {
        'sea-qa-project-navigation-item-active': isActive,
      })}
      style={{ paddingLeft: level > 1 ? (level - 1) * 20 + 8 : 8 }}
      onClick={() => onClick([nav.key])}
      title={name}
    >
      {icon && (<Icon symbol={icon} className="sea-qa-project-navigation-item-icon" />)}
      <span className="sea-qa-project-navigation-item-name">{name}</span>
    </div>
  );
};

export default Nav;
