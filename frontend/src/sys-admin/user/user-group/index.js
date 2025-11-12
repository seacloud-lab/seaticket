import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import { CenteredLoading, CenteredError } from '@/components';
import { Utils } from '@/utils/utils';
import { gettext } from '@/constants';
import Nav from '../user-nav';
import AddUserToGroupsOperation from './add-user-to-groups';
import sysAdminAPI from '@/sys-admin/api';
import { TopBar, Main } from '../../main-panel';
import UserTitle from '../user-title';
import GroupsTable from '@/sys-admin/groups/groups-table';

const UserGroups = ({ email, onCloseSidePanel }) => {
  const [user, setUser] = useState({});
  const [isLoading, setLoading] = useState(true);
  const [errMessage, setErrorMessage] = useState('');
  const [isShowAddGroupsDialog, setIsShowAddGroupsDialog] = useState(false);

  const groupsTableRef = useRef(null);

  const openAddGroupsDialog = useCallback(() => {
    setIsShowAddGroupsDialog(true);
  }, []);

  const closeAddGroupsDialog = useCallback(() => {
    setIsShowAddGroupsDialog(false);
  }, []);

  const addToGroups = useCallback((groups) => {
    groupsTableRef.current.addToGroups(groups);
  }, []);

  useEffect(() => {
    const validEmail = decodeURIComponent(email);
    sysAdminAPI.sysAdminGetUser(validEmail).then((res) => {
      setUser(res.data);
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      setErrorMessage(errMessage);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const validEmail = decodeURIComponent(email);
  const btnName = gettext('Add to groups');
  return (
    <>
      <TopBar onCloseSidePanel={onCloseSidePanel}>
        <Button color="secondary" className="operation-item" title={btnName} aria-label={btnName} onClick={openAddGroupsDialog}>
          {btnName}
        </Button>
      </TopBar>
      <Main title={<UserTitle username={user.name} />} >
        <Nav currentItem="groups" email={email} />
        {isLoading && (<CenteredLoading />)}
        {errMessage && (<CenteredError>{errMessage}</CenteredError>)}
        {!isLoading && !errMessage && (
          <GroupsTable
            ref={groupsTableRef}
            columns={[
              { name: gettext('Name'), key: 'name', width: 0.2 },
              { name: gettext('Role'), key: 'owner', width: 0.2 },
              { name: '', key: 'placeholder', width: 0.4 },
              { name: gettext('Created at'), key: 'created_at', width: 0.2 },
              { name: '', key: 'op', width: 44, isFixed: true }
            ]}
            api={() => sysAdminAPI.sysAdminListGroupsJoinedByUser(validEmail)}
            onUserRemove={(group) => sysAdminAPI.sysAdminDeleteGroupMember(group.id, validEmail)}
          />
        )}
      </Main>
      {isShowAddGroupsDialog && (
        <AddUserToGroupsOperation
          email={validEmail}
          groups={groupsTableRef.current.getGroups()}
          addToGroups={addToGroups}
          toggleDialog={closeAddGroupsDialog}
        />
      )}
    </>
  );

};

export default UserGroups;
