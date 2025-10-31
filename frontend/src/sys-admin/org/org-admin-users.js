import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { ActiveStatusEditor, toaster, EmptyTip, Loading, CommonOperationConfirmationDialog } from '@/components';
import OrgNav from './org-nav';
import OrgTitle from './org-title';
import { Main, TopBar } from '../main-panel';
import OpMenu from './user-op-menu';
import dayjs from '@/utils/dayjs';
import { Utils } from '@/utils/utils';
import { gettext, loginUrl, siteRoot, username, mediaUrl } from '@/constants';
import { getStatusOptions } from '@/utils/role-status-utils';
import sysAdminAPI from '@/sys-admin/api';
import { formatWithTimezone } from '@/sea-metadata/utils/column';

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array.isRequired,
  updateStatus: PropTypes.func.isRequired,
  updateUserOrgAdmin: PropTypes.func.isRequired,
  deleteUser: PropTypes.func.isRequired,
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

  render() {
    const { loading, errorMsg, items } = this.props;
    if (loading) {
      return <Loading/>;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No members')} />
      );
      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="30%">{gettext('Name')}</th>
                <th width="25%">{gettext('Status')}</th>
                <th width="35%">{gettext('Create at / Last login')}</th>
                <th width="10%">{/* Operations */}</th>
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
                  updateStatus={this.props.updateStatus}
                  updateUserOrgAdmin={this.props.updateUserOrgAdmin}
                  deleteUser={this.props.deleteUser}
                />);
              })}
            </tbody>
          </table>
        </Fragment>
      );
      return items.length ? table : emptyTip;
    }
  }
}

Content.propTypes = contentPropTypes;

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  updateStatus: PropTypes.func.isRequired,
  updateUserOrgAdmin: PropTypes.func.isRequired,
  deleteUser: PropTypes.func.isRequired
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      highlight: false,
      isDeleteDialogOpen: false,
      isResetPasswordDialogOpen: false
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

  onMenuItemClick = (operation) => {
    const { item } = this.props;
    switch (operation) {
      case 'Delete':
        this.toggleDeleteDialog();
        break;
      case 'Reset password':
        this.toggleResetPasswordDialog();
        break;
      case 'Unset as admin':
        this.props.updateUserOrgAdmin(item.email, false);
        break;
      default:
        break;
    }
  };

  toggleDeleteDialog = (e) => {
    if (e) {
      e.preventDefault();
    }
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  toggleResetPasswordDialog = (e) => {
    if (e) {
      e.preventDefault();
    }
    this.setState({ isResetPasswordDialogOpen: !this.state.isResetPasswordDialogOpen });
  };

  updateStatus = (statusValue) => {
    this.props.updateStatus(this.props.item.email, statusValue);
  };

  deleteUser = () => {
    const { item } = this.props;
    this.props.deleteUser(item.org_id, item.email);
  };

  resetPassword = () => {
    sysAdminAPI.sysAdminResetUserPassword(this.props.item.email).then(res => {
      toaster.success(res.data.reset_tip);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    const { item } = this.props;
    const { isOpIconShown, isDeleteDialogOpen, isResetPasswordDialogOpen } = this.state;

    const itemName = '<span class="op-target">' + Utils.HTMLescape(item.name) + '</span>';
    let deleteDialogMsg = gettext('Are you sure you want to delete {placeholder} ?').replace('{placeholder}', itemName);
    let resetPasswordDialogMsg = gettext('Are you sure you want to reset the password of {placeholder} ?').replace('{placeholder}', itemName);
    const currentStatus = item.active ? 'active' : 'inactive';
    const statusOptions = getStatusOptions(['active', 'inactive']);
    const currentOption = statusOptions.find(item => item.value === currentStatus) || {};

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseEnter}
          onMouseLeave={this.handleMouseLeave}>
          <td><a href={`${siteRoot}sys/users/${encodeURIComponent(item.email)}/`}>{item.name}</a></td>
          <td>
            <ActiveStatusEditor
              isShowDropdownIcon={isOpIconShown}
              currentOption={currentOption}
              menuOptions={statusOptions}
              onChangeOption={this.updateStatus}
              closeShowDropdownIcon={this.handleMouseLeave}
            />
          </td>
          <td title={formatWithTimezone(item.create_time) + ' / ' + formatWithTimezone(item.last_login)}>
            {dayjs(item.create_time).format('YYYY-MM-DD HH:mm:ss')}{' / '}{item.last_login ? dayjs(item.last_login).fromNow() : '--'}
          </td>
          <td>
            {(isOpIconShown && item.email !== username) &&
            <OpMenu
              canUpdateAdmin={true}
              isAdmin={true}
              onMenuItemClick={this.onMenuItemClick}
              onFreezedItem={this.props.onFreezedItem}
              onUnfreezedItem={this.onUnfreezedItem}
            />
            }
          </td>
        </tr>
        {isDeleteDialogOpen &&
        <CommonOperationConfirmationDialog
          title={gettext('Delete member')}
          message={deleteDialogMsg}
          executeOperation={this.deleteUser}
          confirmBtnText={gettext('Delete')}
          toggleDialog={this.toggleDeleteDialog}
        />
        }
        {isResetPasswordDialogOpen &&
        <CommonOperationConfirmationDialog
          title={gettext('Reset password')}
          message={resetPasswordDialogMsg}
          executeOperation={this.resetPassword}
          confirmBtnText={gettext('Reset')}
          toggleDialog={this.toggleResetPasswordDialog}
        />
        }
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const orgUsersPropTypes = {
  orgID: PropTypes.string,
  onCloseSidePanel: PropTypes.func
};

class OrgAdminUsers extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      orgName: '',
      userList: [],
    };
  }

  componentDidMount() {
    sysAdminAPI.sysAdminGetOrg(this.props.orgID).then((res) => {
      this.setState({
        orgName: res.data.org_name
      });
    });
    sysAdminAPI.sysAdminListOrgUsers(this.props.orgID, true).then((res) => {
      this.setState({
        loading: false,
        userList: res.data.users
      });
    }).catch((error) => {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
          });
          location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
        } else {
          this.setState({
            loading: false,
            errorMsg: gettext('Error')
          });
        }
      } else {
        this.setState({
          loading: false,
          errorMsg: gettext('Please check the network.')
        });
      }
    });
  }

  updateUserOrgAdmin = (email, isAdmin) => {
    const { orgID } = this.props;
    sysAdminAPI.sysAdminUpdateOrgUser(orgID, email, 'is_admin', isAdmin).then(res => {
      let user;
      let newUserList = this.state.userList.filter(item => {
        if (item.email !== email) {
          return true;
        }
        user = item;
        return false;
      });
      this.setState({ userList: newUserList });
      if (isAdmin) {
        toaster.success(gettext('Set {user} as admin').replace('{user}', user.name));
      } else {
        toaster.success(gettext('Unset {user} as admin').replace('{user}', user.name));
      }
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  deleteUser = (orgID, email) => {
    sysAdminAPI.sysAdminDeleteOrgUser(orgID, email).then(res => {
      let newUserList = this.state.userList.filter(item => {
        return item.email !== email;
      });
      this.setState({ userList: newUserList });
      toaster.success(gettext('Successfully deleted 1 item.'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  updateStatus = (email, statusValue) => {
    const isActive = statusValue === 'active';
    sysAdminAPI.sysAdminUpdateOrgUser(this.props.orgID, email, 'active', isActive).then(res => {
      let newUserList = this.state.userList.map(item => {
        if (item.email === email) {
          item.active = res.data.active;
        }
        return item;
      });
      this.setState({ userList: newUserList });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    const { orgName } = this.state;
    return (
      <Fragment>
        <TopBar onCloseSidePanel={this.props.onCloseSidePanel} />
        <Main title={(<OrgTitle orgName={orgName} />)}>
          <OrgNav currentItem="admin-users" orgID={this.props.orgID} />
          <Content
            loading={this.state.loading}
            errorMsg={this.state.errorMsg}
            items={this.state.userList}
            updateStatus={this.updateStatus}
            updateUserOrgAdmin={this.updateUserOrgAdmin}
            deleteUser={this.deleteUser}
          />
        </Main>
      </Fragment>
    );
  }
}

OrgAdminUsers.propTypes = orgUsersPropTypes;

export default OrgAdminUsers;
