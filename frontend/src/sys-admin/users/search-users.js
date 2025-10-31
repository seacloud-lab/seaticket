import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button, Form, FormGroup, Col } from 'reactstrap';
import { navigate } from '@gatsbyjs/reach-router';
import { toaster } from '@/components';
import { Utils } from '@/utils/utils';
import { gettext } from '@/constants';
import sysAdminAPI from '@/sys-admin/api';
import { TopBar, Main } from '../main-panel';
import UsersTable from './users-table';
import { SelectedUsersProvider, useSelectedUsers } from './selected-users';
import { isEnter } from '@/utils/hotkey';
import { SearchInput, CommonOperationConfirmationDialog } from '@/components';

const CustomizeTopBar = ({ onCloseSidePanel, deleteUsers }) => {
  const { selectedUsers } = useSelectedUsers();
  const [isBatchDeleteUserDialogOpen, setIsBatchDeleteUserDialogOpen] = useState(false);

  const toggleBatchDeleteUserDialog = useCallback(() => {
    setIsBatchDeleteUserDialogOpen(!isBatchDeleteUserDialogOpen);
  }, [isBatchDeleteUserDialogOpen]);

  const deleteUserInBatch = useCallback(() => {
    sysAdminAPI.sysAdminDeleteUserInBatch(selectedUsers).then(res => {
      const deletedUsers = res.data.success;
      if (deletedUsers.length) {
        const length = deletedUsers.length;
        const msg = length === 1 ?
          gettext('Successfully deleted 1 user.') :
          gettext('Successfully deleted {count} users.').replace('{count}', length);
        toaster.success(msg);
        deleteUsers(deletedUsers);
      }
      res.data.failed.map(item => {
        const msg = `${item.email}: ${item.error_msg}`;
        toaster.danger(msg);
        return item;
      });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }, [selectedUsers, deleteUsers]);

  const isDesktop = Utils.isDesktop();
  return (
    <>
      <TopBar onCloseSidePanel={onCloseSidePanel}>
        {isDesktop ? (
          <>
            {selectedUsers.length > 0 && (
              <Button className="btn btn-secondary operation-item" onClick={toggleBatchDeleteUserDialog}>
                {gettext('Delete users')}
              </Button>
            )}
          </>
        ) : (
          <>
            {selectedUsers.length > 0 && (
              <span className="mobile-dropdown-item dropdown-item" onClick={toggleBatchDeleteUserDialog}>
                {gettext('Delete users')}
              </span>
            )}
          </>
        )}
      </TopBar>
      {isBatchDeleteUserDialogOpen && (
        <CommonOperationConfirmationDialog
          title={gettext('Delete users')}
          message={gettext('Are you sure you want to delete the selected user(s) ?')}
          executeOperation={deleteUserInBatch}
          confirmBtnText={gettext('Delete')}
          toggleDialog={toggleBatchDeleteUserDialog}
        />
      )}
    </>
  );
};

const SearchUsers = ({ onCloseSidePanel }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');

  const lastSearchValue = useRef('');
  const usersTableRef = useRef(null);

  const onSearch = useCallback((query, page, perPage) => {
    if (lastSearchValue.current === query) return;
    let url = new URL(location.href);
    let searchParams = new URLSearchParams(url.search);
    searchParams.set('query', query);
    url.search = searchParams.toString();
    navigate(url.toString());
    lastSearchValue.current = query;
    return sysAdminAPI.sysAdminSearchUsers(query, page, perPage);
  }, []);

  const onChange = useCallback((value) => {
    setSearchValue(value);
  }, []);

  const loadData = useCallback((page, perPage) => {
    return usersTableRef.current.loadData(searchValue, page, perPage);
  }, [searchValue]);

  const onKeyDown = useCallback((event) => {
    if (isEnter(event)) {
      event.preventDefault();
      event.stopPropagation();
      loadData();
      return;
    }
  }, [loadData]);

  const onModify = useCallback((...params) => {
    return sysAdminAPI.sysAdminUpdateUser(...params);
  }, []);

  const onDelete = useCallback((...params) => {
    return sysAdminAPI.sysAdminDeleteUser(...params);
  }, []);

  const onResetPassword = useCallback((...params) => {
    return sysAdminAPI.sysAdminResetUserPassword(...params);
  }, []);

  const deleteUsers = useCallback((users) => {
    usersTableRef.current.deleteUsers(users);
  }, []);

  useEffect(() => {
    const params = (new URL(document.location)).searchParams;
    const searchValue = params.get('query', '') || '';
    setSearchValue(searchValue);
    setIsLoading(false);
  }, []);

  if (isLoading) return null;

  return (
    <SelectedUsersProvider>
      <CustomizeTopBar onCloseSidePanel={onCloseSidePanel} deleteUsers={deleteUsers} />
      <Main title={gettext('Users')} >
        <UsersTable
          type="database"
          ref={usersTableRef}
          api={(page, perPage) => onSearch(searchValue, page, perPage)}
          onModify={onModify}
          onDelete={onDelete}
          onResetPassword={onResetPassword}
        >
          <div className="mt-4 mb-6">
            <h4 className="border-bottom font-weight-normal mb-2 pb-1">{gettext('Search users')}</h4>
            <Form>
              <FormGroup row>
                <Col sm={5}>
                  <SearchInput isShowSearchIcon={false} value={searchValue} onChange={onChange} onKeyDown={onKeyDown} />
                </Col>
              </FormGroup>
              <FormGroup row>
                <Col sm={{ size: 5 }}>
                  <Button color="outline-primary" disabled={!searchValue.trim()} onClick={loadData} >
                    {gettext('Submit')}
                  </Button>
                </Col>
              </FormGroup>
            </Form>
          </div>
          <div className="mt-4">
            <h4 className="border-bottom font-weight-normal mb-2 pb-1">{gettext('Result')}</h4>
          </div>
        </UsersTable>
      </Main>
    </SelectedUsersProvider>
  );
};

export default SearchUsers;

