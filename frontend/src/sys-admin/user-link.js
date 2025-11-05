import React from 'react';
import { Link } from '@gatsbyjs/reach-router';
import { siteRoot } from '@/constants';

const UserLink = ({ user }) => {
  if (!user) return null;
  return (
    <Link to={`${siteRoot}sys/users/${encodeURIComponent(user.email)}/`}>
      {user.name}
    </Link>
  );
};

export default UserLink;
