import React, { cloneElement, isValidElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Dropdown } from 'reactstrap';
import dayjs from 'dayjs';
import classnames from 'classnames';
import { Link } from '@gatsbyjs/reach-router';
import { gettext, siteRoot, username } from '@/constants';
import { useSelectedUsers } from '../selected-users';
import {
  CustomizeDropdownMoreToggle, CustomizeDropdownMenu, CustomizeDropdownItem,
  CommonOperationConfirmationDialog, ModalPortal,
  SelectEditor, ActiveStatusEditor,
  toaster,
} from '@/components';
import { getRoleOptions, getStatusOptions, translateStatus } from '@/utils/role-status-utils';
import UserLink from '../../user-link';

const { availableRoles, availableAdminRoles, institutions } = window.sysadmin.pageOptions;

const User = ({
  type = '',
  columns,
  hasFreezed,
  user,
  updateFreezed,
  onDelete,
  onResetPassword,
  onModify,
  updateAdminRole,
  revokeAdmin,
  setAsAdmin,
  unsetAsAdmin,
}) => {
  const [highlight, setHighlight] = useState(false);
  const [isMoreMenuShow, setIsMoreMenuShow] = useState(false);
  const [opType, setOpType] = useState('');
  const { selectedUsers, toggleUser } = useSelectedUsers();

  const ops = useMemo(() => {
    let _ops = [];
    if (onDelete) {
      _ops.push({
        name: gettext('Delete'),
        callback: () => setOpType('delete'),
      });
    }
    if (onResetPassword) {
      _ops.push({
        name: gettext('Reset password'),
        callback: () => setOpType('reset_password'),
      });
    }
    if (setAsAdmin && !user.is_org_admin) {
      _ops.push({
        name: gettext('Set as admin'),
        callback: () => setAsAdmin(user.email),
      });
    }
    if (unsetAsAdmin && user.is_org_admin) {
      _ops.push({
        name: gettext('Unset as admin'),
        callback: () => unsetAsAdmin(user.email),
      });
    }
    if (type === 'admin') {
      _ops = [{
        name: gettext('Revoke admin'),
        callback: () => setOpType('revoke_admin'),
      }];
    }
    return _ops;
  }, [type, user, onDelete, onResetPassword, setAsAdmin, unsetAsAdmin]);

  const onMouseEnter = useCallback(() => {
    if (hasFreezed) return;
    setHighlight(true);
  }, [hasFreezed]);

  const onMouseLeave = useCallback(() => {
    if (hasFreezed) return;
    if (isMoreMenuShow) return;
    setHighlight(false);
  }, [hasFreezed, isMoreMenuShow]);

  const toggleMoreMenu = useCallback(() => {
    setIsMoreMenuShow(!isMoreMenuShow);
  }, [isMoreMenuShow]);

  const updateStatus = useCallback((key, value) => {
    const isActive = value === 'active';
    if (isActive) {
      toaster.notify(gettext('It may take some time, please wait.'));
      onModify(user.email, key, isActive);
      return;
    }
    setOpType(key);
  }, [user, onModify]);

  useEffect(() => {
    updateFreezed && updateFreezed(isMoreMenuShow);
    if (!isMoreMenuShow) {
      setHighlight(false);
    }
  }, [isMoreMenuShow, updateFreezed]);

  const { email, name } = user;

  return (
    <>
      <tr className={classnames('', { 'tr-highlight': highlight })} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {columns.map(c => {
          const { key, formatter } = c;
          if (key === 'checkbox') {
            return (
              <td className="pl-2" key={key}>
                <input
                  type="checkbox"
                  className="vam"
                  onChange={() => toggleUser(email)}
                  checked={selectedUsers.includes(email) || ''}
                />
              </td>
            );
          }
          if (key === 'op' && email !== username) {
            return (
              <td key={key} className="admin-user-icon">
                {highlight && ops.length > 0 && (
                  <Dropdown isOpen={isMoreMenuShow} toggle={toggleMoreMenu} className="d-flex">
                    <CustomizeDropdownMoreToggle isOpen={isMoreMenuShow} className="ml-0" />
                    <CustomizeDropdownMenu>
                      {ops.map((o, index) => <CustomizeDropdownItem key={index} onClick={o.callback}>{o.name}</CustomizeDropdownItem>)}
                    </CustomizeDropdownMenu>
                  </Dropdown>
                )}
              </td>
            );
          }
          if (key === 'name-') {
            return (
              <td key={key}>
                <UserLink user={user} />
                {user.contact_email && (
                  <>
                    <br />
                    {user.contact_email}
                  </>
                )}
                {user.org_id &&
                  <>
                    <br />
                    <Link to={`${siteRoot}sys/organizations/${user.org_id}/info/`}>({user.org_name})</Link>
                  </>
                }
              </td>
            );
          }
          if (key === 'unit') {
            return (
              <td key={key}>{user.unit || '--'}</td>
            );
          }
          if (key === 'institution') {
            return (
              <td key={key}>
                <SelectEditor
                  isTextMode={true}
                  isEditIconShow={onModify && highlight && institutions.length > 0}
                  options={institutions}
                  currentOption={user[key]}
                  onOptionChanged={(v) => onModify(email, key, v)}
                  translateOption={(a) => a}
                />
              </td>
            );
          }
          if (key === 'is_active' || key === 'active') {
            const value = user[key];
            const currentStatus = value ? 'active' : 'inactive';
            const statusOptions = getStatusOptions(['active', 'inactive']);
            const statusOption = statusOptions.find(item => item.value === currentStatus) || {};
            return (
              <td key={key}>
                {user.email === username ? translateStatus(currentStatus) : (
                  <ActiveStatusEditor
                    isShowDropdownIcon={highlight}
                    currentOption={statusOption}
                    menuOptions={statusOptions}
                    onChangeOption={(value) => updateStatus(key, value)}
                    closeShowDropdownIcon={onMouseLeave}
                  />)
                }
              </td>
            );
          }
          if (key === 'role') {
            const roleOptions = getRoleOptions(availableRoles);
            const roleOption = roleOptions.find(option => option.value === user.role) || {};
            const adminOptions = getRoleOptions(availableAdminRoles);
            const adminOption = adminOptions.find(option => option.value === user.admin_role) || {};

            return (
              <td key={key}>
                {type === 'admin' ? (
                  <ActiveStatusEditor
                    isShowDropdownIcon={highlight}
                    currentOption={adminOption}
                    menuOptions={adminOptions}
                    onChangeOption={(v) => updateAdminRole(email, v)}
                    closeShowDropdownIcon={onMouseLeave}
                  />
                ) : (!user.org_id ? (
                  <ActiveStatusEditor
                    isShowDropdownIcon={highlight}
                    currentOption={roleOption}
                    menuOptions={roleOptions}
                    onChangeOption={(v) => onModify(email, 'role', v)}
                    closeShowDropdownIcon={onMouseLeave}
                  />
                ) : (
                  <>
                    {'--'}
                  </>
                ))}

              </td>
            );
          }
          if (key === 'create_login') {
            if (c['isLinebreak'] === false) {
              return (
                <td key={key}>
                  {`${user.create_time ? dayjs(user.create_time).format('YYYY-MM-DD HH:mm') : '--'} / ${user.last_login ? dayjs(user.last_login).fromNow() : '--'}`}
                </td>
              );
            }
            return (
              <td key={key}>
                {`${user.create_time ? dayjs(user.create_time).format('YYYY-MM-DD HH:mm') : '--'} /`}
                <br />
                {`${user.last_login ? dayjs(user.last_login).fromNow() : '--'}`}
              </td>
            );
          }
          const value = user[key];
          const valueFormatter = formatter && isValidElement(formatter) ? cloneElement(formatter, {
            user
          }) : value;
          return (
            <td key={key}>
              {valueFormatter}
            </td>
          );
        })}
      </tr>
      {opType === 'delete' && (
        <ModalPortal>
          <CommonOperationConfirmationDialog
            title={gettext('Delete user')}
            message={gettext('Are you sure you want to delete the user {user} ?').replace('{user}', `<b>${name}</b>`)}
            executeOperation={() => onDelete && onDelete(email)}
            confirmBtnText={gettext('Delete')}
            toggleDialog={() => setOpType('')}
          />
        </ModalPortal>
      )}
      {opType === 'reset_password' && (
        <ModalPortal>
          <CommonOperationConfirmationDialog
            title={gettext('Reset password')}
            message={gettext('Are you sure you want to reset the password of {user} ?').replace('{user}', `<b>${name}</b>`)}
            executeOperation={() => onResetPassword(email)}
            confirmBtnText={gettext('Reset')}
            toggleDialog={() => setOpType('')}
          />
        </ModalPortal>
      )}
      {(opType === 'is_active' || opType === 'active') && (
        <CommonOperationConfirmationDialog
          title={gettext('Set user inactive')}
          message={gettext('Are you sure you want to set {user} inactive?').replace('{user}', `<b>${name}</b>`)}
          toggleDialog={() => setOpType('')}
          executeOperation={() => onModify(email, opType, false)}
          confirmBtnText={gettext('Set')}
        />
      )}
      {opType === 'revoke_admin' && (
        <CommonOperationConfirmationDialog
          title={gettext('Revoke admin')}
          message={gettext('Are you sure you want to revoke the admin permission of {user} ?').replace('{user}', `<b>${name}</b>`)}
          executeOperation={() => revokeAdmin(email, name)}
          confirmBtnText={gettext('Revoke')}
          toggleDialog={() => setOpType('')}
        />
      )}
    </>
  );
};

export default User;
