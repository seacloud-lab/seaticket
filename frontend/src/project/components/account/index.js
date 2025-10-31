import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import ClickOutside from '@/components/click-outside';
import { isEsc } from '@/utils/hotkey';
import { siteRoot, mediaUrl, isOrgStaff, useExternalTeamAdmin, gettext } from '@/constants';

import './index.css';

const Account = ({ user }) => {
  const [isShowPopover, setIsShowPopover] = useState(false);

  const onKeydown = useCallback((event) => {
    if (isEsc(event)) {
      event && event.stopPropagation();
      setIsShowPopover(false);
    }
  }, []);

  const onClick = useCallback((event) => {
    if (!user) return;
    event && event.stopPropagation();
    setIsShowPopover(true);
  }, [user]);

  const closePopover = useCallback(() => {
    setIsShowPopover(false);
  }, []);

  const defaultAvatarUrl = `${mediaUrl}avatars/default.png`;
  const avatarUrl = user ? user.avatar_url : defaultAvatarUrl;
  const teamAdminUrl = useExternalTeamAdmin ? `${siteRoot}external-team-admin/` : `${siteRoot}org/manage/`;

  return (
    <>
      <div
        id="account-container"
        className="account-container d-flex align-items-center"
        onClick={onClick}
        onKeyDown={onKeydown}
        title={gettext('Avatar')}
        aria-label={gettext('Avatar')}
        role="button"
        tabIndex={0}
      >
        <div className="account-avatar">
          <img src={avatarUrl} alt=''/>
        </div>
      </div>
      {isShowPopover && (
        <ClickOutside onClickOutside={closePopover}>
          <div className="account-details-popover">
            <div className="account-details-content d-flex align-items-center">
              <img className="avatar mr-1" src={avatarUrl} alt=''/>
              <div className="user-name">{user.name}</div>
            </div>
            <a href={siteRoot + 'profile/'} className="account-settings-item">{gettext('Personal settings')}</a>
            {isOrgStaff && (<a href={teamAdminUrl} className="account-settings-item">{gettext('Team admin')}</a>)}
            <a href={siteRoot + 'accounts/logout/'} className="account-settings-item">{gettext('Log out')}</a>
          </div>
        </ClickOutside>
      )}
    </>
  );
};

Account.propTypes = {
  user: PropTypes.object,
};

export default Account;
