import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import { toaster } from '@/components';
import SysAdminAddUserDialog from '@/sys-admin/dialog/sysadmin-add-user-dialog';
import OrgNav from './org-nav';
import OrgTitle from './org-title';
import { Main, TopBar } from '../main-panel';
import { Utils } from '@/utils/utils';
import { gettext } from '@/constants';
import sysAdminAPI from '@/sys-admin/api';
import UsersTable from '../users/users-table';
import { SelectedUsersProvider } from '../users/selected-users';

const OrgUsers = ({ orgID, onCloseSidePanel }) => {
  const [searchValue, setSearchValue] = useState('');
  const [orgName, setOrgName] = useState('');
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);

  const usersTableRef = useRef(null);

  const openAddUserDialog = useCallback(() => {
    setIsAddUserDialogOpen(true);
  }, []);

  const closeAddUserDialog = useCallback(() => {
    setIsAddUserDialogOpen(false);
  }, []);

  const onChangeSearchValue = useCallback((newValue) => {
    if (searchValue === newValue) return;
    setSearchValue(newValue);
  }, [searchValue]);

  const addUser = useCallback((newUserInfo) => {
    const { email, name, password } = newUserInfo;
    sysAdminAPI.sysAdminAddOrgUser(orgID, email, name, password).then(res => {
      usersTableRef.current.addUsers([res.data]);
    }).catch((error) => {
      let errMsg = '';
      if (error.response) {
        const statusCode = error.response.status;
        const errorData = error.response.data;
        const serverMsg = (errorData && errorData['error_msg']) ? errorData['error_msg'] : '';
        if (statusCode === 409 || /You can only invite \d+ members\./.test(serverMsg)) {
          errMsg = gettext('The number of users exceeds the limit of your current plan.');
        } else {
          errMsg = Utils.getErrorMsg(error);
        }
      } else {
        errMsg = gettext('Please check the network.');
      }
      toaster.danger(errMsg);
    });
  }, []);

  useEffect(() => {
    sysAdminAPI.sysAdminGetOrg(orgID).then((res) => {
      setOrgName(res.data.org_name);
    });
  }, []);

  return (
    <SelectedUsersProvider>
      <TopBar onCloseSidePanel={onCloseSidePanel}></TopBar>
      <Main title={(<OrgTitle orgName={orgName} />)}>
        <OrgNav currentItem="users" orgID={orgID} searchValue={searchValue} onChangeSearchValue={onChangeSearchValue}/>
        <Button className="btn btn-secondary operation-item mt-4" onClick={openAddUserDialog}>{gettext('Add member')}</Button>
        <UsersTable
          ref={usersTableRef}
          searchValue={searchValue}
          showOrganization={false}
          columns={[
            { key: 'name-', width: 0.3, name: `${gettext('Name')} / ${gettext('Contact email')}` },
            { key: 'active', width: 0.3, name: gettext('Status') },
            { key: 'placeholder', width: 0.1 },
            { key: 'create_login', width: 0.3, name: `${gettext('Created at')} / ${gettext('Last login')}`, isLinebreak: false },
            { key: 'op', width: 44, isFixed: true },
          ]}
          showPaginator={false}
          api={() => sysAdminAPI.sysAdminListOrgUsers(orgID, false)}
          onDelete={(userEmail) => sysAdminAPI.sysAdminDeleteOrgUser(orgID, userEmail)}
          onModify={(userEmail, key, value) => sysAdminAPI.sysAdminUpdateOrgUser(orgID, userEmail, key, value)}
          setAsAdmin={(userEmail) => sysAdminAPI.sysAdminUpdateOrgUser(orgID, userEmail, 'is_admin', true)}
          onResetPassword={(userEmail) => sysAdminAPI.sysAdminResetUserPassword(userEmail)}
        />
      </Main>
      {isAddUserDialogOpen && (<SysAdminAddUserDialog addUser={addUser} toggleDialog={closeAddUserDialog} />)}
    </SelectedUsersProvider>
  );
};

export default OrgUsers;
