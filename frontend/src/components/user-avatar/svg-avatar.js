import React from 'react';
import { parseEmailUserInfo } from '@/utils/email';

const SvgAvatar = ({ user, size = 16, children }) => {
  if (!user) return null;
  const { initials, color } = parseEmailUserInfo(user);

  return (
    <div
      className="seaqa-svg-avatar-container d-flex align-items-center justify-content-center position-relative"
      style={{ color, height: size, width: size }}
      title={user?.fullName || user?.name || ''}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 50 50" role="presentation"
        style={{ height: size, width: size }}
        className="seaqa-svg-avatar"
      >
        <circle fill="currentColor" cx="25" cy="25" r="25"></circle>
        <path fill="rgba(255,255,255,.2)" d="M4.2,38.8A24.7,24.7,0,0,0,25,50,25,25,0,0,0,50,25a25.6,25.6,0,0,0-4.2-13.9L25,25Z"></path>
        <path fill="rgba(255,255,255,.1)" d="M25,25,4.2,11.1A25.6,25.6,0,0,0,0,25,24.2,24.2,0,0,0,4.2,38.8Z"></path>
      </svg>
      <div
        className="seaqa-svg-avatar-name position-absolute text-white w-100 h-100 d-flex align-items-center justify-content-center"
        style={{ fontSize: size * (initials.length === 1 ? .6 : .5) }}
      >
        {initials}
      </div>
      {children}
    </div>
  );
};

export default SvgAvatar;
