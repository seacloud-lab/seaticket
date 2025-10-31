import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Dropdown } from 'reactstrap';
import { ActiveStatusEditor, toaster, CommonOperationConfirmationDialog,
  CustomizeDropdownMoreToggle, CustomizeDropdownMenu, CustomizeDropdownItem
} from '@/components';
import { gettext, siteRoot, orgID, username } from '@/constants';
import { Utils } from '@/utils/utils';
import { getStatusOptions, translateStatus } from '@/utils/role-status-utils';
import orgAdminAPI from '../api';

class User extends React.Component {

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
  };

  toggleResetPW = () => {
    const email = this.props.user.email;
    const name = this.props.user.name;
    toaster.success(gettext('Resetting user\'s password, please wait for a moment.'));
    orgAdminAPI.orgAdminResetOrgUserPassword(orgID, email).then(res => {
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
    orgAdminAPI.orgAdminChangeOrgUserStatus(orgID, this.props.user.email, statusCode).then(res => {
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
    let { user, currentTab, columns } = this.props;
    const { currentStatus } = this.state;
    let href = siteRoot + 'org/users/info/' + encodeURIComponent(user.email) + '/';
    let isOperationMenuShow = (user.email !== username) && this.state.showMenu;
    const statusOptions = getStatusOptions(this.statusArray);
    const statusOption = statusOptions.find(option => option.value === currentStatus) || {};

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
          {columns.map(c => {
            const { key } = c;
            if (key === 'name') {
              return (
                <td key={key}>
                  <a href={href} className="font-weight-normal">{user.name}</a>
                </td>
              );
            }

            if (key === 'status') {
              return (
                <td key={key}>
                  {user.email === username ? translateStatus(currentStatus) : (
                    <ActiveStatusEditor
                      isShowDropdownIcon={isOperationMenuShow}
                      currentOption={statusOption}
                      menuOptions={statusOptions}
                      onChangeOption={this.onChangeOption}
                      closeShowDropdownIcon={this.onMouseLeave}
                    />
                  )}
                </td>
              );
            }

            if (key === 'create_at_last_login') {
              return (<td key={key}>{user.ctime} / {user.last_login ? user.last_login : '--'}</td>);
            }

            if (key === 'placeholder') {
              return (<td key={key}></td>);
            }

            if (key === 'op') {
              return (
                <td className="text-center cursor-pointer" key={key}>
                  {isOperationMenuShow && (
                    <Dropdown isOpen={this.state.isItemMenuShow} toggle={this.toggleOperationMenu}>
                      <CustomizeDropdownMoreToggle isOpen={this.state.isItemMenuShow} onClick={this.onDropdownToggleClick} />
                      <CustomizeDropdownMenu>
                        {currentTab === 'users' && (
                          <>
                            <CustomizeDropdownItem onClick={this.toggleDeleteDialog}>{gettext('Delete')}</CustomizeDropdownItem>
                            <CustomizeDropdownItem onClick={this.toggleResetPW}>{gettext('Reset password')}</CustomizeDropdownItem>
                          </>
                        )}
                        {currentTab === 'admins' && (
                          <CustomizeDropdownItem onClick={this.toggleRevokeAdmin}>{gettext('Revoke admin')}</CustomizeDropdownItem>
                        )}
                      </CustomizeDropdownMenu>
                    </Dropdown>
                  )}
                </td>
              );
            }

            return null;
          })}
        </tr>
        {this.state.isDeleteDialogShow && (
          <CommonOperationConfirmationDialog
            title={gettext('Delete user')}
            message={gettext('Are you sure you want to delete {user} ?').replace('{user}', `<b>${user.name}</b>`)}
            toggleDialog={this.toggleDeleteDialog}
            executeOperation={this.toggleDelete}
            confirmBtnText={gettext('Delete')}
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

User.propTypes = {
  user: PropTypes.object,
  currentTab: PropTypes.string,
  toggleRevokeAdmin: PropTypes.func,
  isItemFreezed: PropTypes.bool.isRequired,
  toggleDelete: PropTypes.func.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
};

export default User;
