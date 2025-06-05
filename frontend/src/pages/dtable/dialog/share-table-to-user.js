import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Button } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import UserSelect from '../../../components/user-select';
import DtableSharePermissionEditor from '../../../components/select-editor/dtable-share-permission-editor';
import DepartmentDetailDialog from './department-detail-dialog';
import UserInfoPopover from '../dtable-popover/user-info-popover';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { Utils } from '../../../utils/utils';
import { gettext, cloudMode, isOrgContext } from '../../../utils/constants';

import '../../../css/invitations.css';

const userItemPropTypes = {
  item: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  customSharePermissions: PropTypes.array,
  deleteTableShare: PropTypes.func.isRequired,
  updateTableShare: PropTypes.func.isRequired,
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

  deleteTableShare = () => {
    this.props.deleteTableShare(this.props.item.email);
  };

  updateTableShare = (permission) => {
    if (permission === 'addCustomSharePermission') return;
    this.props.updateTableShare(this.props.item.email, permission);
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
            onPermissionChanged={this.updateTableShare}
            onAddCustomSharePermission={this.props.onAddCustomSharePermission}
          />
        </td>
        <td>
          <span
            className={`dtable-font dtable-icon-x action-icon ml-8 ${isOperationShow ? '' : 'hide'}`}
            onClick={this.deleteTableShare}
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
  currentTable: PropTypes.object.isRequired,
  customSharePermissions: PropTypes.array,
  onAddCustomSharePermission: PropTypes.func,
};

class ShareTableToUser extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      selectedOptions: null,
      permission: 'rw',
      userList: [],
      isShowDepartmentDetailDialog: false
    };
    this.workspaceID = this.props.currentTable.workspace_id;
    this.tableName = this.props.currentTable.name;
  }

  componentDidMount() {
    dtableWebAPI.listTableShares(this.workspaceID, this.tableName).then((res) => {
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

  addTableShare = () => {
    const { selectedOptions, permission, userList } = this.state;
    if (!selectedOptions || selectedOptions.length === 0) return;
    for (let i = 0; i < selectedOptions.length; i++) {
      let name = selectedOptions[i].value;
      let email = selectedOptions[i].email;
      let avatar_url = selectedOptions[i].avatar_url;
      dtableWebAPI.addTableShare(this.workspaceID, this.tableName, email, permission).then((res) => {
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

  deleteTableShare = (email) => {
    const { userList } = this.state;
    dtableWebAPI.deleteTableShare(this.workspaceID, this.tableName, email).then((res) => {
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

  updateTableShare = (email, permission) => {
    dtableWebAPI.updateTableShare(this.workspaceID, this.tableName, email, permission).then((res) => {
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

  toggleDepartmentDetailDialog = () => {
    this.setState({ isShowDepartmentDetailDialog: !this.state.isShowDepartmentDetailDialog });
  };

  addUserShares = async (membersSelectedObj) => {
    const { permission, userList } = this.state;
    let emails = Object.keys(membersSelectedObj);
    for (let i = 0; i < emails.length; i++) {
      let email = emails[i];
      let avatar_url = membersSelectedObj[email].avatar_url;
      await dtableWebAPI.addTableShare(this.workspaceID, this.tableName, email, permission).then((res) => {
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

    this.toggleDepartmentDetailDialog();
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
          deleteTableShare={this.deleteTableShare}
          updateTableShare={this.updateTableShare}
          customSharePermissions={this.props.customSharePermissions}
          onAddCustomSharePermission={this.props.onAddCustomSharePermission}
        />
      );
    });

    return (
      <div className="share-link-container">
        {cloudMode && !isOrgContext &&
          <div className="share-link-tip">{gettext('Please enter the full email address to share the base with the user. You can also generate a share link and sent it to another user to join the base.')}</div>}
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
                  {showDeptBtn &&
                  <span
                    onClick={this.toggleDepartmentDetailDialog}
                    className="dtable-font dtable-icon-add_members toggle-detail-btn">
                  </span>
                  }
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
                <Button className="w-100" onClick={this.addTableShare}>{gettext('Submit')}</Button>
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
          {this.state.isShowDepartmentDetailDialog &&
          <DepartmentDetailDialog
            toggleDepartmentDetailDialog={this.toggleDepartmentDetailDialog}
            addUserShares={this.addUserShares}
            userList={this.state.userList}
            usedFor='add_user_share'
          />
          }
        </div>
      </div>

    );
  }
}

ShareTableToUser.propTypes = propTypes;

export default ShareTableToUser;
