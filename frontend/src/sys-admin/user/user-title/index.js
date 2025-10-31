import React from 'react';
import { Link } from '@gatsbyjs/reach-router';
import { siteRoot, gettext } from '@/constants';

import './index.css';

const UserTitle = ({ username }) => {
  return (
    <>
      <Link to={`${siteRoot}sys/users/`} className="sys-admin-user-title">
        {gettext('Users')}
      </Link>
      {' / '}
      {username}
    </>
  );
};

export default UserTitle;
