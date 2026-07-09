import React, { useEffect, useRef, useState } from 'react';
import OrgNav from './org-nav';
import OrgTitle from './org-title';
import { Main, TopBar } from '../main-panel';
import { gettext } from '@/constants';
import sysAdminAPI from '@/sys-admin/api';
import UsersTable from '../users/users-table';
import { SelectedUsersProvider } from '../users/selected-users';

const OrgUsers = ({ orgID, onCloseSidePanel }) => {
  const [orgName, setOrgName] = useState('');

  const usersTableRef = useRef(null);

  useEffect(() => {
    sysAdminAPI.sysAdminGetOrg(orgID).then((res) => {
      setOrgName(res.data.org_name);
    });
  }, [orgID]);

  return (
    <SelectedUsersProvider>
      <TopBar onCloseSidePanel={onCloseSidePanel} />
      <Main title={(<OrgTitle orgName={orgName} />)}>
        <OrgNav currentItem="admin-users" orgID={orgID} />
        <UsersTable
          ref={usersTableRef}
          showOrganization={false}
          columns={[
            { key: 'name-', width: 0.3, name: `${gettext('Name')} / ${gettext('Contact email')}` },
            { key: 'active', width: 0.3, name: gettext('Status') },
            { key: 'placeholder', width: 0.1 },
            { key: 'create_login', width: 0.3, name: `${gettext('Created at')} / ${gettext('Last login')}`, isLinebreak: false },
            { key: 'op', width: 44, isFixed: true },
          ]}
          showPaginator={false}
          api={() => sysAdminAPI.sysAdminListOrgUsers(orgID, true)}
          onDelete={(userEmail) => sysAdminAPI.sysAdminDeleteOrgUser(orgID, userEmail)}
          onModify={(userEmail, key, value) => sysAdminAPI.sysAdminUpdateOrgUser(orgID, userEmail, key, value)}
          unsetAsAdmin={(userEmail) => sysAdminAPI.sysAdminUpdateOrgUser(orgID, userEmail, 'is_admin', false)}
          onResetPassword={(userEmail) => sysAdminAPI.sysAdminResetUserPassword(userEmail)}
        />
      </Main>
    </SelectedUsersProvider>
  );
};

export default OrgUsers;
