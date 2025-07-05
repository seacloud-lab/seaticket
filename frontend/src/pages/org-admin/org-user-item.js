import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { RoleStatusEditor, toaster } from 'dtable-ui-component';
import { gettext, siteRoot, orgID, username } from '../../constants';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import { Utils } from '../../utils/utils';
import DeleteConfirmDialog from '../../components/dialog/orgadmin-dialog/delete-item-confirm-dialog';
import CommonOperationConfirmationDialog from '../../components/dialog/common-operation-confirmation-dialog';
import { getStatusOptions, translateStatus } from '../../utils/role-status-utils';

const propTypes = {
  user: PropTypes.object,
  currentTab: PropTypes.string,
  toggleRevokeAdmin: PropTypes.func,
  isItemFreezed: PropTypes.bool.isRequired,
  toggleDelete: PropTypes.func.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
};

class UserItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      highlight: false,
      showMenu: false,
      currentStatus: this.props.user.is_active ? 'active' : 'inactive',
      isItemMenuShow: false,
      isDeleteDialogShow: false,
      isShowInactiveDialog: false,
    };

    this.statusArray = ['active', 'inactive'];
  }

  onMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        showMenu: true,
        highlight: true,
      });
    }
  };

  onMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        showMenu: false,
        highlight: false
      });
    }
  };

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogShow: !this.state.isDeleteDialogShow });
  };

  toggleDelete = () => {
    this.props.toggleDelete(this.props.user);
    this.toggleDeleteDialog();
  };

  toggleResetPW = () => {
    const email = this.props.user.email;
    const name = this.props.user.name;
    toaster.success(gettext('Resetting user\'s password, please wait for a moment.'));
    orgAdminServiceApi.orgAdminResetOrgUserPassword(orgID, email).then(res => {
      let msg;
      msg = gettext('Successfully reset password to %(passwd)s for user %(user)s.');
      msg = msg.replace('%(passwd)s', res.data.new_password);
      msg = msg.replace('%(user)s', name);
      toaster.success(msg, {
        duration: 15
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  toggleRevokeAdmin = () => {
    const email = this.props.user.email;
    this.props.toggleRevokeAdmin(email);
  };

  toggleConfirmInactiveDialog = () => {
    this.setState({ isShowInactiveDialog: !this.state.isShowInactiveDialog });
  };

  onChangeOption = (option) => {
    let statusCode;
    if (option === 'active') {
      statusCode = 1;
      this.changeStatus(statusCode);
    } else {
      this.toggleConfirmInactiveDialog();
    }
  };

  confirmInactiveUser = () => {
    this.changeStatus(0);
  };

  changeStatus = (statusCode) => {
    orgAdminServiceApi.orgAdminChangeOrgUserStatus(orgID, this.props.user.email, statusCode).then(res => {
      this.setState({
        currentStatus: statusCode === 1 ? 'active' : 'inactive',
        highlight: false,
        showMenu: false,
      });
      toaster.success(gettext('Edit succeeded.'));
    }).catch(error => {
      if (error.response && error.response.status === 409) { // maybe over limit
        toaster.danger(gettext('The number of users exceeds the limit of your current plan.'));
      } else {
        let errMessage = Utils.getErrorMsg(error);
        if (errMessage === gettext('Error')) {
          errMessage = gettext('Edit failed.');
        }
        toaster.danger(errMessage);
      }
    });
  };

  onDropdownToggleClick = (e) => {
    e.preventDefault();
    this.toggleOperationMenu(e);
  };

  toggleOperationMenu = (e) => {
    e.stopPropagation();
    this.setState(
      { isItemMenuShow: !this.state.isItemMenuShow }, () => {
        if (this.state.isItemMenuShow) {
          this.props.onFreezedItem();
        } else {
          this.setState({
            highlight: false,
            showMenu: false,
          });
          this.props.onUnfreezedItem();
        }
      }
    );
  };

  render() {
    let { user, currentTab } = this.props;
    const { currentStatus } = this.state;
    let href = siteRoot + 'org/useradmin/info/' + encodeURIComponent(user.email) + '/';
    let isOperationMenuShow = (user.email !== username) && this.state.showMenu;
    const statusOptions = getStatusOptions(this.statusArray);
    const statusOption = statusOptions.find(option => option.value === currentStatus) || {};

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
          <td>
            <a href={href} className="font-weight-normal">{user.name}</a>
          </td>
          <td>
            {user.email === username ? translateStatus(currentStatus) : (
              <RoleStatusEditor
                isShowDropdownIcon={isOperationMenuShow}
                currentOption={statusOption}
                menuOptions={statusOptions}
                onChangeOption={this.onChangeOption}
                closeShowDropdownIcon={this.onMouseLeave}
              />
            )}
          </td>
          <td>{user.ctime} / {user.last_login ? user.last_login : '--'}</td>
          <td className="text-center cursor-pointer">
            {isOperationMenuShow && (
              <Dropdown isOpen={this.state.isItemMenuShow} toggle={this.toggleOperationMenu}>
                <DropdownToggle
                  tag="a"
                  role="button"
                  className="attr-action-icon dtable-font dtable-icon-more-vertical"
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                  data-toggle="dropdown"
                  aria-expanded={this.state.isItemMenuShow}
                  onClick={this.onDropdownToggleClick}
                />
                <DropdownMenu className="sea-qa-dropdown-menu dropdown-menu">
                  {currentTab === 'users' && <DropdownItem onClick={this.toggleDeleteDialog}>{gettext('Delete')}</DropdownItem>}
                  {currentTab === 'users' && <DropdownItem onClick={this.toggleResetPW}>{gettext('ResetPwd')}</DropdownItem>}
                  {currentTab === 'admins' && <DropdownItem onClick={this.toggleRevokeAdmin}>{gettext('Revoke admin')}</DropdownItem>}
                </DropdownMenu>
              </Dropdown>
            )}
          </td>
        </tr>
        {this.state.isDeleteDialogShow && (
          <DeleteConfirmDialog
            headerText={gettext('Delete user')}
            toggle={this.toggleDeleteDialog}
            onDelete={this.toggleDelete}
            itemName={user.name}
            isOpen={this.state.isDeleteDialogShow}
          />
        )}
        {this.state.isShowInactiveDialog &&
          <CommonOperationConfirmationDialog
            title={gettext('Set user inactive')}
            message={gettext('Are you sure you want to set xxx inactive?').replace('xxx', '<span class="op-target">' + Utils.HTMLescape(user.name) + '</span>')}
            toggleDialog={this.toggleConfirmInactiveDialog}
            executeOperation={this.confirmInactiveUser}
            confirmBtnText={gettext('Set')}
          />
        }
      </Fragment>
    );
  }
}

UserItem.propTypes = propTypes;

export default UserItem;
