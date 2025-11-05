import React, { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { navigate } from '@gatsbyjs/reach-router';
import { Button } from 'reactstrap';
import { toaster, CommonOperationConfirmationDialog, EnterSearchInput
} from '@/components';
import SysAdminImportUserDialog from '@/sys-admin/dialog/sysadmin-import-user-dialog';
import SysAdminAddUserDialog from '@/sys-admin/dialog/sysadmin-add-user-dialog';
import SysAdminBatchAddAdminDialog from '@/sys-admin/dialog/sysadmin-batch-add-admin-dialog';
import SysAdminUser from '@/models/sysadmin-user';
import SysAdminAdminUser from '@/models/sysadmin-admin-user';
import UsersNav from './users-nav';
import { Utils } from '@/utils/utils';
import { isPro, gettext, siteRoot } from '@/constants';
import sysAdminAPI from '@/sys-admin/api';
import { Main, TopBar } from '@/sys-admin/main-panel';
import UsersTable from './users-table';
import { SelectedUsersProvider, useSelectedUsers } from './selected-users';
import { downloadFile } from '@/utils/download';

const { availableRoles } = window.sysadmin.pageOptions;

const CustomizeTopBar = ({ isAdmin, onCloseSidePanel, addUsers, deleteUsers }) => {
  const { selectedUsers } = useSelectedUsers();
  const [isBatchDeleteUserDialogOpen, setIsBatchDeleteUserDialogOpen] = useState(false);
  const [isImportUserDialogOpen, setIsImportUserDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isBatchAddAdminDialogOpen, setIsBatchAddAdminDialogOpen] = useState(false);

  const toggleBatchDeleteUserDialog = useCallback(() => {
    setIsBatchDeleteUserDialogOpen(!isBatchDeleteUserDialogOpen);
  }, [isBatchDeleteUserDialogOpen]);

  const toggleBatchAddAdminDialog = useCallback(() => {
    setIsBatchAddAdminDialogOpen(!isBatchAddAdminDialogOpen);
  }, [isBatchAddAdminDialogOpen]);

  const toggleImportUserDialog = useCallback(() => {
    setIsImportUserDialogOpen(!isImportUserDialogOpen);
  }, [isImportUserDialogOpen]);

  const toggleAddUserDialog = useCallback(() => {
    setIsAddUserDialogOpen(!isAddUserDialogOpen);
  }, [isAddUserDialogOpen]);

  const jumpToSearch = useCallback((keyword) => {
    navigate(`${siteRoot}sys/search-users/?query=${encodeURIComponent(keyword)}`);
  }, []);

  const exportExcel = useCallback(() => {
    downloadFile(`${siteRoot}sys/users/export-excel/`);
  }, []);

  const importUserInBatch = useCallback((file) => {
    toaster.notify(gettext('It may take some time, please wait.'));
    sysAdminAPI.sysAdminImportUserViaFile(file).then((res) => {
      if (res.data.success.length) {
        const users = res.data.success.map(user => new SysAdminUser(user));
        addUsers(users);
      }
      res.data.failed.array.forEach(item => {
        const msg = `${item.email}: ${item.error_msg}`;
        toaster.danger(msg);
      });
    }).catch((error) => {
      let errMsg = Utils.getErrorMsg(error);
      toaster.danger(errMsg);
    });
  }, [addUsers]);

  const addUser = useCallback((data) => {
    toaster.notify(gettext('It may take some time, please wait.'));
    const { email, name, role, password } = data;
    sysAdminAPI.sysAdminAddUser(email, name, role, password).then((res) => {
      toaster.success(res.data.add_user_tip);
      addUsers(res.data);
    }).catch((error) => {
      let errMsg = '';
      if (error.response) {
        if (error.response.status === 403) {
          const errorData = error.response.data;
          errMsg = errorData && errorData['error_msg'] ? gettext(errorData['error_msg']) : gettext('Permission denied');
        } else {
          errMsg = Utils.getErrorMsg(error);
        }
      } else {
        errMsg = gettext('Please check the network.');
      }
      toaster.danger(errMsg);
    });
  }, [addUsers]);

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

  const addAdminInBatch = useCallback((emails) => {
    sysAdminAPI.sysAdminAddAdminInBatch(emails).then(res => {
      let users = res.data.success.map(user => new SysAdminAdminUser(user));
      addUsers(users);
      res.data.failed.map(item => {
        const msg = `${item.email}: ${item.error_msg}`;
        toaster.danger(msg);
        return item;
      });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }, []);

  const renderOperations = useCallback(() => {
    if (isAdmin) {
      return (
        <Button className="btn btn-secondary operation-item" onClick={toggleBatchAddAdminDialog}>
          {gettext('Add admin')}
        </Button>
      );
    }
    return (
      <Fragment>
        <Button className="btn btn-secondary operation-item" onClick={toggleImportUserDialog}>{gettext('Import users')}</Button>
        <Button className="btn btn-secondary operation-item" onClick={toggleAddUserDialog}>{gettext('Add user')}</Button>
        <Button className="btn btn-secondary operation-item" onClick={exportExcel}>{gettext('Export Excel')}</Button>
      </Fragment>
    );
  }, [isAdmin, toggleBatchAddAdminDialog, toggleImportUserDialog, toggleAddUserDialog, exportExcel]);

  const renderMobileOperations = useCallback(() => {
    if (isAdmin) {
      return <span className="mobile-dropdown-item dropdown-item" onClick={toggleBatchAddAdminDialog}>{gettext('Add admin')}</span>;
    }
    return (
      <Fragment>
        <span className="mobile-dropdown-item dropdown-item" onClick={toggleImportUserDialog}>{gettext('Import users')}</span>
        <span className="mobile-dropdown-item dropdown-item" onClick={toggleAddUserDialog}>{gettext('Add user')}</span>
        <span className="mobile-dropdown-item dropdown-item" onClick={exportExcel}>{gettext('Export Excel')}</span>
      </Fragment>
    );
  }, [isAdmin, toggleBatchAddAdminDialog, toggleImportUserDialog, toggleAddUserDialog, exportExcel]);

  const isDesktop = Utils.isDesktop();
  return (
    <>
      <TopBar
        search={isAdmin ? null : (<EnterSearchInput placeholder={gettext('Search users')} onSubmit={jumpToSearch} />)}
        onCloseSidePanel={onCloseSidePanel}
      >
        {isDesktop ? (
          <>
            {selectedUsers.length > 0 ? (
              <Button className="btn btn-secondary operation-item" onClick={toggleBatchDeleteUserDialog}>
                {gettext('Delete users')}
              </Button>
            ) : (
              <>
                {renderOperations()}
              </>
            )}
          </>
        ) : (
          <>
            {selectedUsers.length > 0 ? (
              <span className="mobile-dropdown-item dropdown-item" onClick={toggleBatchDeleteUserDialog}>
                {gettext('Delete users')}
              </span>
            ) : (
              <>
                {renderMobileOperations()}
              </>
            )}
          </>
        )}
      </TopBar>
      {isImportUserDialogOpen && (
        <SysAdminImportUserDialog
          toggle={toggleImportUserDialog}
          importUserInBatch={importUserInBatch}
        />
      )}
      {isAddUserDialogOpen && (
        <SysAdminAddUserDialog
          dialogTitle={gettext('Add user')}
          showRole={isPro}
          availableRoles={availableRoles}
          addUser={addUser}
          toggleDialog={toggleAddUserDialog}
        />
      )}
      {isBatchDeleteUserDialogOpen && (
        <CommonOperationConfirmationDialog
          title={gettext('Delete users')}
          message={gettext('Are you sure you want to delete the selected user(s) ?')}
          executeOperation={deleteUserInBatch}
          confirmBtnText={gettext('Delete')}
          toggleDialog={toggleBatchDeleteUserDialog}
        />
      )}
      {isBatchAddAdminDialogOpen && (
        <SysAdminBatchAddAdminDialog
          addAdminInBatch={addAdminInBatch}
          toggle={toggleBatchAddAdminDialog}
        />
      )}
    </>
  );
};

const AllUsers = ({ isAdmin, onCloseSidePanel }) => {
  const usersTableRef = useRef(null);

  const api = useMemo(() => {
    if (isAdmin) return (...params) => sysAdminAPI.sysAdminListAdmins(...params);
    return (...params) => sysAdminAPI.sysAdminListUsers(...params);
  }, [isAdmin]);

  const updateAdminRole = useCallback((...params) => {
    return sysAdminAPI.sysAdminUpdateAdminRole(...params);
  }, []);

  const onModify = useCallback((...params) => {
    return sysAdminAPI.sysAdminUpdateUser(...params);
  }, []);

  const onDelete = useCallback((...params) => {
    return sysAdminAPI.sysAdminDeleteUser(...params);
  }, []);

  const onResetPassword = useCallback((...params) => {
    return sysAdminAPI.sysAdminResetUserPassword(...params);
  }, []);

  const revokeAdmin = useCallback((...params) => {
    return sysAdminAPI.sysAdminUpdateUser(...params);
  }, []);

  const addUsers = useCallback((users) => {
    usersTableRef.current.addUsers(users);
  }, []);

  const deleteUsers = useCallback((users) => {
    usersTableRef.current.deleteUsers(users);
  }, []);

  return (
    <SelectedUsersProvider>
      <CustomizeTopBar
        isAdmin={isAdmin}
        onCloseSidePanel={onCloseSidePanel}
        addUsers={addUsers}
        deleteUsers={deleteUsers}
      />
      <Main
        title={<UsersNav currentItem={isAdmin ? 'admin' : 'database'} />}
        titleClassName="cur-view-path sys-user-nav tab-nav-container"
      >
        <UsersTable
          type="database"
          ref={usersTableRef}
          api={api}
          showPaginator={!isAdmin}
          updateAdminRole={updateAdminRole}
          onModify={onModify}
          onDelete={onDelete}
          onResetPassword={onResetPassword}
          revokeAdmin={revokeAdmin}
        />
      </Main>
    </SelectedUsersProvider>
  );
};
export default AllUsers;
