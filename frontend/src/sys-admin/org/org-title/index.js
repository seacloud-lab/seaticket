import React from 'react';
import { Link } from '@gatsbyjs/reach-router';
import { siteRoot, gettext } from '@/constants';

import './index.css';

const OrgTitle = ({ orgName }) => {
  return (
    <>
      <Link to={`${siteRoot}sys/organizations/`} className="sys-admin-org-title">
        {gettext('Organizations')}
      </Link>
      {' / '}
      {orgName}
    </>
  );
};

export default OrgTitle;
