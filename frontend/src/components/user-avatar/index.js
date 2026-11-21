import React from 'react';
import SvgAvatar from './svg-avatar';

const UserAvatar = ({ user, size = 16 }) => {
  if (!user?.avatar_url) return (<SvgAvatar size={size} user={user} />);

  return (
    <img className="seaqa-user-avatar" alt={user.name} src={user.avatar_url} />
  );
};

export default UserAvatar;
