import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Button } from 'reactstrap';
import toaster from '../../toaster';
import UserSelect from '../../../components/user-select';
import DtableSharePermissionEditor from '../../../components/select-editor/dtable-share-permission-editor';
import { UserInfoPopover } from '../../../components/popover';
import { Utils } from '../../../utils/utils';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import { gettext, cloudMode, isOrgContext } from '../../../constants';

import '../../../css/invitations.css';

const userItemPropTypes = {
  item: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  customSharePermissions: PropTypes.array,
  deleteProjectShare: PropTypes.func.isRequired,
  updateProjectShare: PropTypes.func.isRequired,
  onAddCustomSharePermission: PropTypes.func,
};

class UserItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isOperationShow: false,
      isUserDetailPopoverShow: false,
    };
  }

  onMouseEnter = () => {
    this.setState({ isOperationShow: true });
  };

  onMouseLeave = () => {
    this.setState({ isOperationShow: false });
  };

  deleteProjectShare = () => {
    this.props.deleteProjectShare(this.props.item.email);
  };

  updateProjectShare = (permission) => {
    if (permission === 'addCustomSharePermission') return;
    this.props.updateProjectShare(this.props.item.email, permission);
  };

  onShareMouseEnter = (event) => {
    const _this = this;
    this.handleTimer = setTimeout(() => {
      _this.setState({ isUserDetailPopoverShow: true });
    }, 500);
  };

  onShareMouseLeave = (event) => {
    clearTimeout(this.handleTimer);
    this.setState({ isUserDetailPopoverShow: false });
  };

  render() {
    let { item, index } = this.props;
    let currentPermission = item.permission;
    let { isUserDetailPopoverShow, isOperationShow } = this.state;
    return (
      <tr onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
        <td>
          <img onMouseEnter={this.onShareMouseEnter} onMouseLeave={this.onShareMouseLeave} className="share-user-avatar" src={item.avatar_url} id={`shared-user${index}`} alt="" />
          <UserInfoPopover
            target={`shared-user${index}`}
            isUserDetailPopoverShow={isUserDetailPopoverShow}
            userEmail={this.props.item.email}
          >
          </UserInfoPopover>
        </td>
        <td className="name">
          {item.name}
        </td>
        <td>
          <DtableSharePermissionEditor
            isTextMode={true}
            isEditIconShow={this.state.isOperationShow}
            currentPermission={currentPermission}
            customSharePermissions={this.props.customSharePermissions}
            onPermissionChanged={this.updateProjectShare}
            onAddCustomSharePermission={this.props.onAddCustomSharePermission}
          />
        </td>
        <td>
          <span
            className={`dtable-font dtable-icon-x action-icon ml-8 ${isOperationShow ? '' : 'hide'}`}
            onClick={this.deleteProjectShare}
            title={gettext('Delete')}
            aria-label={gettext('Delete')}
          >
          </span>
        </td>
      </tr>
    );
  }
}

UserItem.propTypes = userItemPropTypes;

const propTypes = {
  currentProject: PropTypes.object.isRequired,
  customSharePermissions: PropTypes.array,
  onAddCustomSharePermission: PropTypes.func,
};

class SysAdminShareTableToUser extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      selectedOptions: null,
      permission: 'rw',
      userList: [],
    };
    this.Uuid = this.props.currentProject.uuid;
  }

  componentDidMount() {
    sysAdminServiceApi.sysAdminListProjectShares(this.uuid).then((res) => {
      this.setState({ userList: res.data.user_list });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  }

  handleSelectChange = (options) => {
    this.setState({ selectedOptions: options });
  };

  setPermission = (permission) => {
    this.setState({ permission: permission });
  };

  addProjectShare = () => {
    const { selectedOptions, permission, userList } = this.state;
    if (!selectedOptions || selectedOptions.length === 0) return;
    for (let i = 0; i < selectedOptions.length; i++) {
      let name = selectedOptions[i].value;
      let email = selectedOptions[i].email;
      let avatar_url = selectedOptions[i].avatar_url;
      sysAdminServiceApi.sysAdminAddProjectShare(this.uuid, email, permission).then((res) => {
        let userInfo = {
          name: name,
          email: email,
          permission: permission,
          avatar_url: avatar_url,
        };
        userList.push(userInfo);
        this.setState({ userList: userList });
      }).catch(error => {
        let errMsg = Utils.getErrorMsg(error, true);
        if (!error.response || error.response.status !== 403) {
          toaster.danger(errMsg);
        }
      });
    }
    this.setState({ selectedOption: null });
    this.refs.userSelect.clearSelect();
  };

  deleteProjectShare = (email) => {
    const { userList } = this.state;
    sysAdminServiceApi.sysAdminDeleteProjectShare(this.uuid, email).then((res) => {
      let newUserList = userList.filter(userInfo => {
        return userInfo.email !== email;
      });
      this.setState({
        userList: newUserList,
      });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (errMsg.indexOf('not shared to') > -1) {
        let newUserList = userList.filter(userInfo => {
          return userInfo.email !== email;
        });
        this.setState({
          userList: newUserList,
        });
        return;
      }
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  updateProjectShare = (email, permission) => {
    sysAdminServiceApi.sysAdminUpdateProjectShare(this.uuid, email, permission).then((res) => {
      let userList = this.state.userList.filter(userInfo => {
        if (userInfo.email === email) {
          userInfo.permission = permission;
        }
        return userInfo;
      });
      this.setState({
        userList: userList,
      });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (errMsg.indexOf('not shared to') > -1) {
        toaster.danger(gettext('The other party has left sharing.'));
        return;
      }
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  addUserShares = async (membersSelectedObj) => {
    const { permission, userList } = this.state;
    let emails = Object.keys(membersSelectedObj);
    for (let i = 0; i < emails.length; i++) {
      let email = emails[i];
      let avatar_url = membersSelectedObj[email].avatar_url;
      await sysAdminServiceApi.sysAdminAddProjectShare(this.uuid, email, permission).then((res) => {
        let userInfo = {
          name: membersSelectedObj[email].name,
          email: email,
          permission: permission,
          avatar_url: avatar_url,
        };
        userList.push(userInfo);
        this.setState({ userList: userList });
      }).catch(error => {
        let errMsg = Utils.getErrorMsg(error, true);
        if (!error.response || error.response.status !== 403) {
          toaster.danger(errMsg);
        }
      });
    }
  };

  render() {
    let showDeptBtn = true;
    if (cloudMode && !isOrgContext) {
      showDeptBtn = false;
    }
    const renderUserList = this.state.userList.map((item, index) => {
      return (
        <UserItem
          key={index}
          item={item}
          index={index}
          deleteProjectShare={this.deleteProjectShare}
          updateProjectShare={this.updateProjectShare}
          customSharePermissions={this.props.customSharePermissions}
          onAddCustomSharePermission={this.props.onAddCustomSharePermission}
        />
      );
    });

    return (
      <div className="share-link-container">
        <table>
          <thead>
            <tr>
              <th width="45%">{gettext('User')}</th>
              <th width="35%">{gettext('Permission')}</th>
              <th width="20%"></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className='add-members'>
                  <UserSelect
                    ref="userSelect"
                    isMulti={true}
                    className={classnames('reviewer-select', { 'user-select-right-btn': showDeptBtn })}
                    placeholder={gettext('Search users')}
                    onSelectChange={this.handleSelectChange}
                    excludeCurrentUser={false}
                  />
                </div>
              </td>
              <td>
                <DtableSharePermissionEditor
                  isTextMode={false}
                  isEditIconShow={false}
                  currentPermission={this.state.permission}
                  customSharePermissions={this.props.customSharePermissions}
                  onPermissionChanged={this.setPermission}
                  onAddCustomSharePermission={this.props.onAddCustomSharePermission}
                />
              </td>
              <td>
                <Button className="w-100" onClick={this.addProjectShare}>{gettext('Submit')}</Button>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="share-list-container">
          <table className="table-thead-hidden">
            <thead>
              <tr>
                <th width="6%"></th>
                <th width="40%">{gettext('User')}</th>
                <th width="34%">{gettext('Permission')}</th>
                <th width="20%"></th>
              </tr>
            </thead>
            <tbody>
              {renderUserList}
            </tbody>
          </table>
        </div>
      </div>

    );
  }
}

SysAdminShareTableToUser.propTypes = propTypes;

export default SysAdminShareTableToUser;
