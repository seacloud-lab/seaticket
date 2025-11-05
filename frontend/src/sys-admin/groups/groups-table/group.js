import React, { cloneElement, isValidElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Dropdown } from 'reactstrap';
import dayjs from 'dayjs';
import classnames from 'classnames';
import { Link } from '@gatsbyjs/reach-router';
import { formatWithTimezone } from '@/sea-metadata/utils/column';
import { gettext, siteRoot } from '@/constants';
import {
  ModalPortal, CommonOperationConfirmationDialog,
  CustomizeDropdownMoreToggle, CustomizeDropdownMenu, CustomizeDropdownItem,
} from '@/components';
import SysAdminTransferGroupDialog from '@/sys-admin/dialog/sysadmin-group-transfer-dialog';

const Group = ({
  columns,
  hasFreezed,
  group,
  updateFreezed,
  onDelete,
  onUserRemove,
  onTransfer,
}) => {
  const [highlight, setHighlight] = useState(false);
  const [isMoreMenuShow, setIsMoreMenuShow] = useState(false);
  const [opType, setOpType] = useState('');

  const ops = useMemo(() => {
    let _ops = [];
    if (onDelete) {
      _ops.push({
        name: gettext('Delete'),
        callback: () => setOpType('delete'),
      });
    }
    if (onTransfer) {
      _ops.push({
        name: gettext('Transfer'),
        callback: () => setOpType('transfer'),
      });
    }
    if (onUserRemove) {
      _ops.push({
        name: gettext('Remove from group'),
        callback: () => setOpType('user_remove'),
      });
    }
    return _ops;
  }, [onDelete, onUserRemove, onTransfer]);

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

  const getRoleText = useCallback((role) => {
    let roleText;
    switch (role) {
      case 'Owner':
        roleText = gettext('Owner');
        break;
      case 'Admin':
        roleText = gettext('Admin');
        break;
      case 'Member':
        roleText = gettext('Member');
        break;
      default:
        break;
    }
    return roleText;
  }, []);

  useEffect(() => {
    updateFreezed && updateFreezed(isMoreMenuShow);
    if (!isMoreMenuShow) {
      setHighlight(false);
    }
  }, [isMoreMenuShow, updateFreezed]);

  return (
    <>
      <tr className={classnames('', { 'tr-highlight': highlight })} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {columns.map(c => {
          const { key, formatter } = c;
          if (key === 'op') {
            return (
              <td key={key} className="admin-group-icon">
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
          const value = group[key];
          if (key === 'role') {
            const roleName = getRoleText(value);
            return (
              <td key={key}>
                {roleName}
              </td>
            );
          }
          if (key === 'name') {
            const groupUrl = `${siteRoot}sys/groups/${group.id}/projects/`;
            return (
              <td key={key}>
                <Link to={groupUrl}>{group.name}</Link>
                <>
                  {group.org_id && group.org_id !== -1 &&
                    <>
                      <br />
                      <Link to={`${siteRoot}sys/organizations/${group.org_id}/info/`}>({group.org_name})</Link>
                    </>
                  }
                </>
              </td>
            );
          }
          if (key === 'creator_name') {
            return (
              <td key={key}>
                {group.creator_email === 'system admin' ?
                  '--' :
                  <Link to={`${siteRoot}sys/users/${encodeURIComponent(group.creator_email)}/`}>{group.creator_name}</Link>
                }
              </td>
            );
          }
          if (key === 'owner') {
            return (
              <td key={key}>
                {group.owner === 'system admin' ?
                  '--' :
                  <Link to={`${siteRoot}sys/users/${encodeURIComponent(group.owner)}/`}>{group.owner_name}</Link>
                }
              </td>
            );
          }
          if (key === 'created_at') {
            return (
              <td title={formatWithTimezone(value)} key={key}>
                {dayjs(value).format('YYYY-MM-DD HH:mm:ss')}
              </td>
            );
          }
          const valueFormatter = formatter && isValidElement(formatter) ? cloneElement(formatter, {
            group
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
            title={gettext('Delete group')}
            message={gettext('Are you sure you want to delete the group {name} ?').replace('{name}', `<b>${group.name}</b>`)}
            executeOperation={() => onDelete && onDelete(group)}
            confirmBtnText={gettext('Delete')}
            toggleDialog={() => setOpType('')}
          />
        </ModalPortal>
      )}
      {opType === 'transfer' && (
        <ModalPortal>
          <SysAdminTransferGroupDialog
            item={group}
            transferGroup={(userEmail) => onTransfer && onTransfer(group.id, userEmail)}
            toggleDialog={() => setOpType('')}
          />
        </ModalPortal>
      )}
      {opType === 'user_remove' && (
        <CommonOperationConfirmationDialog
          title={gettext('Remove from group')}
          message={gettext('Are you sure you want to remove from {name} ?').replace('{name}', `<b>${group.name}</b>`)}
          executeOperation={() => onUserRemove && onUserRemove(group)}
          confirmBtnText={gettext('Remove')}
          toggleDialog={() => setOpType('')}
        />
      )}
    </>
  );
};

export default Group;
