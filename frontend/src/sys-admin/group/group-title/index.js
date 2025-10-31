import React from 'react';
import { Link } from '@gatsbyjs/reach-router';
import { siteRoot, gettext } from '@/constants';

import './index.css';

const GroupTitle = ({ groupName }) => {
  return (
    <>
      <Link to={`${siteRoot}sys/groups/`} className="sys-admin-group-title">
        {gettext('Groups')}
      </Link>
      {' / '}
      {groupName}
    </>
  );
};

export default GroupTitle;
