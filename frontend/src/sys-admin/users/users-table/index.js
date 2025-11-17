import React, { forwardRef, useCallback, useEffect, useState, useImperativeHandle, useMemo } from 'react';
import { gettext, mediaUrl, loginUrl, isPro, multiInstitution, isShowUint } from '@/constants';
import { Utils } from '@/utils/utils';
import {
  CenteredLoading, CenteredError,
  FixedWidthTable, EmptyTip, Paginator, toaster,
} from '@/components';
import User from './user';
import { useSelectedUsers } from '../selected-users';

const UsersTable = forwardRef(({
  placeholder = gettext('No users'),
  type,
  showPaginator = true,
  columns: customizeColumns,
  searchValue = '',
  api,
  onModify,
  onDelete,
  onResetPassword,
  updateAdminRole,
  revokeAdmin,
  setAsAdmin,
  unsetAsAdmin,
  children,
  ...params
}, ref) => {
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [count, setCount] = useState(0);
  const [hasFreezed, setHasFreezed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { selectedUsers, updateSelectedUsers } = useSelectedUsers();

  const columns = useMemo(() => {
    if (Array.isArray(customizeColumns) && customizeColumns.length > 0) {
      return customizeColumns;
    }
    const userEmails = users.map(u => u.email);
    return [
      {
        key: 'checkbox', width: 44, isFixed: true,
        children: (
          <>
            <input
              type="checkbox"
              className="vam ml-2"
              onChange={() => updateSelectedUsers(selectedUsers.length === users.length ? [] : userEmails)}
              checked={selectedUsers.length === users.length}
            />
          </>
        )
      },
      { key: 'name-', width: 0.2, name: `${gettext('Name')} / ${gettext('Contact email')}` },
      { key: 'is_active', width: 0.2, name: gettext('Status') },
      isShowUint ? { key: 'unit', width: 0.1, name: gettext('Unit') } : { key: 'placeholder-1', width: 0.1 },
      isPro ? { key: 'role', width: 0.2, name: gettext('Role') } : { key: 'placeholder-2', width: 0.2 },
      (multiInstitution && !(type === 'admin')) ? { key: 'institution', width: 0.1, name: gettext('Institution') } : { key: 'placeholder-3', width: 0.1 },
      { key: 'create_login', width: 0.2, name: `${gettext('Created at')} / ${gettext('Last login')}` },
      { key: 'op', width: 44, isFixed: true },
    ];
  }, [isPro, multiInstitution, type, users, selectedUsers, customizeColumns, updateSelectedUsers]);

  const loadData = useCallback((page, perPage) => {
    setErrorMessage('');
    api(page, perPage).then((res) => {
      const { users, count = 0 } = res.data;
      setUsers(users);
      setCount(count);
      setIsLoading(false);
    }).catch(error => {
      if (error?.response?.status === 403) {
        setErrorMessage(gettext('Permission denied'));
        setIsLoading(false);
        location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
      }

      const errMessage = Utils.getErrorMsg(error);
      setErrorMessage(errMessage);
      setIsLoading(false);
    });
  }, [api]);

  const updateFreezed = useCallback((hasFreezed) => {
    setHasFreezed(hasFreezed);
  }, []);

  const getPreviousPageProjects = useCallback(() => {
    const previousPage = page - 1;
    setPage(previousPage);
    loadData(previousPage, perPage);
  }, [page, perPage, loadData]);

  const getNextPageProjects = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadData(nextPage, perPage);
  }, [page, perPage, loadData]);

  const resetPerPage = useCallback((perPage) => {
    setPerPage(perPage);
    setPage(1);
    loadData(1, perPage);
  }, []);

  const handleDelete = useCallback((userEmail) => {
    let newUsers = users.slice(0);
    const user = users.find(u => u.email === userEmail);
    if (!user) return;
    onDelete(userEmail).then(res => {
      newUsers = newUsers.filter(p => p.email !== userEmail);
      setUsers(newUsers);
      toaster.success(gettext('%s deleted').replace('%s', gettext('1 user')));
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }, [users, onDelete]);

  const handleResetPassword = useCallback((userEmail) => {
    const user = users.find(p => p.email === userEmail);
    if (!user) return;
    onResetPassword(userEmail).then(res => {
      toaster.success(res.data.reset_tip);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }, [users, onResetPassword]);

  const handleModify = useCallback((userEmail, key, value) => {
    onModify(userEmail, key, value).then(res => {
      let newUsers = users.slice(0);
      const userIndex = users.findIndex(u => u.email === userEmail);
      newUsers[userIndex] = {
        ...newUsers[userIndex],
        [key]: value
      };
      setUsers(newUsers);
      const msg = (key === 'is_active' && value) ? res.data.update_status_tip : gettext('Edit succeeded');
      toaster.success(msg);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }, [users, onModify]);

  const handleAdminRole = useCallback((userEmail, role) => {
    updateAdminRole(userEmail, role).then(res => {
      let newUsers = users.slice(0);
      const userIndex = newUsers.findIndex(u => u.email === userEmail);
      newUsers[userIndex] = {
        ...newUsers[userIndex],
        admin_role: res.data.role
      };
      setUsers(newUsers);
      toaster.success(gettext('Edit succeeded'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }, [users, updateAdminRole]);

  const handleRevokeAdmin = useCallback((userEmail, name) => {
    let newUsers = users.slice(0);
    const user = newUsers.find(u => u.email === userEmail);
    if (!user) return;
    revokeAdmin(userEmail, 'is_staff', false).then(res => {
      newUsers = newUsers.filter(p => p.email !== userEmail);
      setUsers(newUsers);
      toaster.success(gettext('The admin permission of {placeholder} revoked'.replace('{placeholder}', name)));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }, [users, revokeAdmin]);

  const handleSetAsAdmin = useCallback((userEmail) => {
    setAsAdmin(userEmail).then(res => {
      let newUsers = users.slice(0);
      const userIndex = newUsers.findIndex(u => u.email === userEmail);
      newUsers[userIndex] = {
        ...newUsers[userIndex],
        is_org_admin: false,
      };
      setUsers(newUsers);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }, [users, setAsAdmin]);

  const handleUnsetAsAdmin = useCallback((userEmail) => {
    unsetAsAdmin(userEmail).then(res => {
      let newUsers = users.slice(0);
      newUsers = newUsers.filter(u => u.email !== userEmail);
      setUsers(newUsers);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }, [users, unsetAsAdmin]);

  useEffect(() => {
    const params = (new URL(document.location)).searchParams;
    const page = parseInt(params.get('page') || 1);
    const perPage = parseInt(parseInt(params.get('per_page') || 25));
    setPage(page);
    setPerPage(perPage);
    loadData(page, perPage);
  }, []);

  useImperativeHandle(ref, () => ({
    reset: () => {
      setUsers([]);
      setPage(1);
      setHasFreezed(false);
      setCount(0);
    },
    loadData: () => loadData(page, perPage),
    addUsers: (addedUsers = []) => {
      let newUsers = users.slice(0);
      newUsers = addedUsers.concat(newUsers);
      setUsers(newUsers);
    },
    deleteUsers: (deletedUsers = []) => {
      const deletedUserEmails = deletedUsers.map(u => typeof u === 'string' ? u : u.email);
      let newUsers = users.slice(0);
      newUsers = newUsers.filter(user => !deletedUserEmails.includes(user.email));
      setUsers(newUsers);

    },
  }), [page, perPage, users, loadData]);

  if (isLoading) {
    return (
      <>
        {children}
        <CenteredLoading />
      </>
    );
  }
  if (errorMessage) {
    return (
      <>
        {children}
        <CenteredError>{errorMessage}</CenteredError>
      </>
    );
  }
  const validSearchValue = searchValue ? searchValue.trim().toLowerCase() : '';
  const displayUsers = validSearchValue ? users.filter(user => user.name.toLowerCase().indexOf(validSearchValue) !== -1) : users;

  if (displayUsers.length === 0 && placeholder) {
    return (
      <>
        {children}
        <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={placeholder} />
      </>
    );
  }

  return (
    <>
      {children}
      <FixedWidthTable columns={columns}>
        {displayUsers.map((user) => {
          return (
            <User
              key={user.email}
              user={user}
              type={type}
              columns={columns}
              hasFreezed={hasFreezed}
              updateFreezed={updateFreezed}
              onModify={handleModify}
              updateAdminRole={handleAdminRole}
              revokeAdmin={handleRevokeAdmin}
              onDelete={onDelete ? handleDelete : null}
              onResetPassword={onResetPassword ? handleResetPassword : null}
              setAsAdmin={setAsAdmin ? handleSetAsAdmin : null}
              unsetAsAdmin={unsetAsAdmin && users.length > 1 ? handleUnsetAsAdmin : null}
              { ...params }
            />
          );
        })}
      </FixedWidthTable>
      {showPaginator && (
        <Paginator
          goPreviousPage={getPreviousPageProjects}
          goNextPage={getNextPageProjects}
          currentPage={page}
          hasNextPage={Utils.hasNextPage(page, perPage, count)}
          canResetPerPage={true}
          curPerPage={perPage}
          resetPerPage={resetPerPage}
        />
      )}
    </>
  );
});

export default UsersTable;
