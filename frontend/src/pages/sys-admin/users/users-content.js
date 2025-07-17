import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import dayjs from '../../../utils/dayjs';
import { EmptyTip, RoleStatusEditor, toaster, Loading, Paginator, CommonOperationConfirmationDialog } from '../../../components';
import { Utils } from '../../../utils/utils';
import { isPro, username, gettext, multiInstitution, siteRoot, mediaUrl } from '../../../constants';
import SelectEditor from '../../../components/select-editor/select-editor';
import OpMenu from '../../../components/dialog/op-menu';
import SysAdminUserSetQuotaDialog from '../../../components/dialog/sysadmin-dialog/set-quota';
import UserLink from '../user-link';
import { getRoleOptions, getStatusOptions } from '../../../utils/role-status-utils';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const { availableRoles, availableAdminRoles, institutions } = window.sysadmin.pageOptions;

const contentPropTypes = {
  isAllUsersSelected: PropTypes.bool,
  isLDAPImported: PropTypes.bool,
  isAdmin: PropTypes.bool,
  isSearchResult: PropTypes.bool,
  loading: PropTypes.bool,
  errorMsg: PropTypes.string,
  items: PropTypes.array,
  updateUser: PropTypes.func,
  deleteUser: PropTypes.func,
  updateAdminRole: PropTypes.func,
  revokeAdmin: PropTypes.func,
  onUserSelected: PropTypes.func,
  toggleSelectAllUsers: PropTypes.func,
  getListByPage: PropTypes.func,
  currentPage: PropTypes.number,
  hasNextPage: PropTypes.bool,
  curPerPage: PropTypes.number,
  resetPerPage: PropTypes.func,
};

class Content extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false
    };
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  getPreviousPage = () => {
    this.props.getListByPage(this.props.currentPage - 1);
  };

  getNextPage = () => {
    this.props.getListByPage(this.props.currentPage + 1);
  };

  render() {
    const { isAdmin, loading, errorMsg, items, isAllUsersSelected, curPerPage, hasNextPage, currentPage } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No users')} />
      );
      let columns = [];
      const colNameText = `${gettext('Name')} / ${gettext('Contact email')}`;
      const colCreatedText = `${gettext('Created at')} / ${gettext('Last login')}`;
      const quotaText = `${gettext('Row')} / ${gettext('Storage used')}`;
      if (isPro) {
        columns.push(
          { width: '20%', text: colNameText },
          { width: '15%', text: gettext('Status') },
          { width: '15%', text: gettext('Role') }
        );
      } else {
        columns.push(
          { width: '30%', text: colNameText },
          { width: '20%', text: gettext('Status') }
        );
      }
      if (multiInstitution && !isAdmin) {
        columns.push(
          { width: '15%', text: quotaText },
          { width: '14%', text: gettext('Institution') },
          { width: '14%', text: colCreatedText },
          { width: '5%', text: '' }
        );
      } else {
        columns.push(
          { width: '15%', text: quotaText },
          { width: '22%', text: colCreatedText },
          { width: '5%', text: '' }
        );
      }

      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="3%" className="pl-2">
                  <input type="checkbox" className="vam" onChange={this.props.toggleSelectAllUsers} checked={isAllUsersSelected} />
                </th>
                {columns.map((item, index) => {
                  return <th width={item.width} key={index}>{item.text}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                return (<Item
                  key={index}
                  item={item}
                  isItemFreezed={this.state.isItemFreezed}
                  onFreezedItem={this.onFreezedItem}
                  onUnfreezedItem={this.onUnfreezedItem}
                  updateUser={this.props.updateUser}
                  deleteUser={this.props.deleteUser}
                  updateAdminRole={this.props.updateAdminRole}
                  revokeAdmin={this.props.revokeAdmin}
                  onUserSelected={this.props.onUserSelected}
                  isAdmin={this.props.isAdmin}
                  isLDAPImported={this.props.isLDAPImported}
                />);
              })}
            </tbody>
          </table>
          {(!this.props.isAdmin) &&
          <Paginator
            goPreviousPage={this.getPreviousPage}
            goNextPage={this.getNextPage}
            currentPage={currentPage}
            hasNextPage={hasNextPage}
            curPerPage={curPerPage}
            resetPerPage={this.props.resetPerPage}
          />
          }
        </Fragment>
      );

      return (items.length || this.props.currentPage !== 1) ? table : emptyTip;
    }
  }
}

Content.propTypes = contentPropTypes;

const itemPropTypes = {
  item: PropTypes.object,
  isItemFreezed: PropTypes.bool,
  isSearchResult: PropTypes.bool,
  onFreezedItem: PropTypes.func,
  onUnfreezedItem: PropTypes.func,
  updateUser: PropTypes.func,
  deleteUser: PropTypes.func,
  updateAdminRole: PropTypes.func,
  revokeAdmin: PropTypes.func,
  onUserSelected: PropTypes.func,
  isAdmin: PropTypes.bool,
  isLDAPImported: PropTypes.bool,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      highlight: false,
      isSetQuotaDialogOpen: false,
      isDeleteUserDialogOpen: false,
      isResetUserPasswordDialogOpen: false,
      isRevokeAdminDialogOpen: false
    };
  }

  handleMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: true,
        highlight: true
      });
    }
  };

  handleMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: false,
        highlight: false
      });
    }
  };

  onUnfreezedItem = () => {
    this.setState({
      highlight: false,
      isOpIconShow: false
    });
    this.props.onUnfreezedItem();
  };

  toggleSetQuotaDialog = () => {
    this.setState({ isSetQuotaDialogOpen: !this.state.isSetQuotaDialogOpen });
  };

  toggleDeleteUserDialog = () => {
    this.setState({ isDeleteUserDialogOpen: !this.state.isDeleteUserDialogOpen });
  };

  toggleResetUserPasswordDialog = () => {
    this.setState({ isResetUserPasswordDialogOpen: !this.state.isResetUserPasswordDialogOpen });
  };

  toggleRevokeAdminDialog = () => {
    this.setState({ isRevokeAdminDialogOpen: !this.state.isRevokeAdminDialogOpen });
  };

  onUserSelected = () => {
    this.props.onUserSelected(this.props.item);
  };

  updateStatus = (value) => {
    const isActive = value === 'active';
    if (isActive) {
      toaster.notify(gettext('It may take some time, please wait.'));
    }
    this.props.updateUser(this.props.item.email, 'is_active', isActive);
  };

  updateRole = (value) => {
    this.props.updateUser(this.props.item.email, 'role', value);
  };

  updateAdminRole = (value) => {
    this.props.updateAdminRole(this.props.item.email, value);
  };

  translateAdminRole = (role) => {
    switch (role) {
      case 'default_admin':
        return gettext('Default admin');
      case 'system_admin':
        return gettext('System admin');
      case 'daily_admin':
        return gettext('Daily admin');
      case 'audit_admin':
        return gettext('Audit admin');
      default:
        return role;
    }
  };

  updateInstitution = (value) => {
    this.props.updateUser(this.props.item.email, 'institution', value);
  };

  translateInstitution = (inst) => {
    return inst;
  };

  updateQuota = (value) => {
    this.props.updateUser(this.props.item.email, 'quota_total', value);
  };

  deleteUser = () => {
    this.props.deleteUser(this.props.item.email);
  };

  resetPassword = () => {
    toaster.notify(gettext('It may take some time, please wait.'));
    sysAdminServiceApi.sysAdminResetUserPassword(this.props.item.email).then(res => {
      toaster.success(res.data.reset_tip);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  revokeAdmin = () => {
    const { item } = this.props;
    this.props.revokeAdmin(item.email, item.name);
  };

  getMenuOperations = () => {
    const {
      isAdmin, isLDAPImported,
      isSearchResult, item
    } = this.props;
    let list = ['Delete'];
    if (!isLDAPImported ||
      (isSearchResult && item.source === 'db')) {
      list.push('Reset password');
    }
    if (isAdmin) {
      list = ['Revoke admin'];
    }
    return list;
  };

  translateOperations = (item) => {
    let translateResult = '';
    switch (item) {
      case 'Delete':
        translateResult = gettext('Delete');
        break;
      case 'Reset password':
        translateResult = gettext('Reset password');
        break;
      case 'Revoke admin':
        translateResult = gettext('Revoke admin');
        break;
      default:
        break;
    }

    return translateResult;
  };

  onMenuItemClick = (operation) => {
    switch (operation) {
      case 'Delete':
        this.toggleDeleteUserDialog();
        break;
      case 'Reset password':
        this.toggleResetUserPasswordDialog();
        break;
      case 'Revoke admin':
        this.toggleRevokeAdminDialog();
        break;
      default:
        break;
    }
  };

  render() {
    const { item, isAdmin } = this.props;
    const {
      isOpIconShown,
      isSetQuotaDialogOpen,
      isDeleteUserDialogOpen,
      isResetUserPasswordDialogOpen,
      isRevokeAdminDialogOpen
    } = this.state;

    const itemName = '<span class="op-target">' + Utils.HTMLescape(item.name) + '</span>';
    const deleteDialogMsg = gettext('Are you sure you want to delete {placeholder} ?').replace('{placeholder}', itemName);
    const resetPasswordDialogMsg = gettext('Are you sure you want to reset the password of {placeholder} ?').replace('{placeholder}', itemName);
    const revokeAdminDialogMsg = gettext('Are you sure you want to revoke the admin permission of {placeholder} ?').replace('{placeholder}', itemName);

    const options = getRoleOptions(availableRoles);
    const option = options.find(option => option.value === item.role) || {};
    const adminOptions = getRoleOptions(availableAdminRoles);
    const adminOption = adminOptions.find(option => option.value === item.admin_role) || {};
    const currentStatus = item.is_active ? 'active' : 'inactive';
    const statusOptions = getStatusOptions(['active', 'inactive']);
    const statusOption = statusOptions.find(item => item.value === currentStatus) || {};

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td className="pl-2">
            <input type="checkbox" className="vam" onChange={this.onUserSelected} checked={item.isSelected} />
          </td>
          <td>
            <UserLink email={item.email} name={item.name} />
            {item.contact_email &&
              <Fragment>
                <br />
                {item.contact_email}
              </Fragment>}
            {item.org_id &&
              <Fragment>
                <br />
                <Link to={`${siteRoot}sys/organizations/${item.org_id}/info/`}>({item.org_name})</Link>
              </Fragment>
            }
          </td>
          <td>
            <RoleStatusEditor
              isShowDropdownIcon={isOpIconShown}
              currentOption={statusOption}
              menuOptions={statusOptions}
              onChangeOption={this.updateStatus}
              closeShowDropdownIcon={this.handleMouseLeave}
            />
          </td>
          {isPro && (
            <td>
              {isAdmin ? (
                <RoleStatusEditor
                  isShowDropdownIcon={isOpIconShown}
                  currentOption={adminOption}
                  menuOptions={adminOptions}
                  onChangeOption={this.updateAdminRole}
                  closeShowDropdownIcon={this.handleMouseLeave}
                />
              ) : (!item.org_id ? (
                <RoleStatusEditor
                  isShowDropdownIcon={isOpIconShown}
                  currentOption={option}
                  menuOptions={options}
                  onChangeOption={this.updateRole}
                  closeShowDropdownIcon={this.handleMouseLeave}
                />
              ) : (
                <Fragment>
                  {'--'}
                </Fragment>
              ))}
            </td>
          )}
          {(multiInstitution && !isAdmin) &&
            <td>
              <SelectEditor
                isTextMode={true}
                isEditIconShow={isOpIconShown && institutions.length > 0}
                options={institutions}
                currentOption={item.institution}
                onOptionChanged={this.updateInstitution}
                translateOption={this.translateInstitution}
              />
            </td>
          }
          <td>
            {item.rows_count}
            {' / '}
            {item.storage_usage > 0 ? Utils.bytesToSize(item.storage_usage) : '--'}
          </td>
          <td>
            {`${item.create_time ? dayjs(item.create_time).format('YYYY-MM-DD HH:mm') : '--'} /`}
            <br />
            {`${item.last_login ? dayjs(item.last_login).fromNow() : '--'}`}
          </td>
          <td>
            {(item.email !== username && isOpIconShown) &&
            <OpMenu
              operations={this.getMenuOperations()}
              translateOperations={this.translateOperations}
              onMenuItemClick={this.onMenuItemClick}
              onFreezedItem={this.props.onFreezedItem}
              onUnfreezedItem={this.onUnfreezedItem}
            />
            }
          </td>
        </tr>
        {isSetQuotaDialogOpen &&
          <SysAdminUserSetQuotaDialog
            toggle={this.toggleSetQuotaDialog}
            updateQuota={this.updateQuota}
          />
        }
        {isDeleteUserDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Delete user')}
            message={deleteDialogMsg}
            executeOperation={this.deleteUser}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.toggleDeleteUserDialog}
          />
        }
        {isResetUserPasswordDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Reset password')}
            message={resetPasswordDialogMsg}
            executeOperation={this.resetPassword}
            confirmBtnText={gettext('Reset')}
            toggleDialog={this.toggleResetUserPasswordDialog}
          />
        }
        {isRevokeAdminDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Revoke admin')}
            message={revokeAdminDialogMsg}
            executeOperation={this.revokeAdmin}
            confirmBtnText={gettext('Revoke')}
            toggleDialog={this.toggleRevokeAdminDialog}
          />
        }
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

export default Content;
