import React, { useEffect, useState } from 'react';
import classnames from 'classnames';
import { Icon, toaster } from '../../../components';
import { notificationAPI } from '../../api';
import { Utils } from '@/utils/utils';

import './index.css';

const { projectUuid } = window.app.pageOptions;
const InboxNav = ({ nav, level, activeBar, onClick }) => {
  const [unseen, setUnseen] = useState(0);
  const { key, name, icon } = nav;
  const isActive = activeBar[0] === key;

  useEffect(() => {
    if (!projectUuid) return;
    const controller = new AbortController();
    notificationAPI.listProjectNotifications(projectUuid, 1, 1, { signal: controller.signal })
      .then(res => {
        const unseenCount = res.data.unseen_count || 0;
        setUnseen(unseenCount);
      }).catch((error) => {
        const errorMsg = Utils.getErrorMsg(error);
        toaster.danger(errorMsg);
      });
    return () => { controller.abort(); };
  }, []);

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
