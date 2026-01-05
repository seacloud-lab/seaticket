import React from 'react';
import classnames from 'classnames';
import { Icon } from '../../../components';
import { useNotification } from '@/sea-metadata';

import './index.css';

const InboxNav = ({ nav, level, activeBar, onClick }) => {
  const { unseen } = useNotification();
  const { key, name, icon } = nav;
  const isActive = activeBar[0] === key;
  const displayCount = unseen > 99 ? '99+' : unseen > 0 ? unseen : null;

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
      {displayCount && (
        <div className="sea-qa-project-navigation-item-inbox-count">
          {displayCount}
        </div>
      )}
    </div>
  );
};

export default InboxNav;
