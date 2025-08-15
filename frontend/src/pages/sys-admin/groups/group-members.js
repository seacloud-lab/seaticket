import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { ActiveStatusEditor, toaster, EmptyTip, Loading, CommonOperationConfirmationDialog, IconButton } from '../../../components';
import { Utils } from '../../../utils/utils';
import { loginUrl, gettext, mediaUrl } from '../../../constants';
import SysAdminGroupAddMemberDialog from '../../../components/dialog/sysadmin-dialog/sysadmin-group-add-member-dialog';
import MainPanelTopbar from '../main-panel-topbar';
import GroupNav from './group-nav';
import UserLink from '../user-link';
import { getRoleOptions } from '../../../utils/role-status-utils';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array,
  departmentId: PropTypes.number,
  removeMember: PropTypes.func,
  updateMemberRole: PropTypes.func,
};

class Content extends Component {

  constructor(props) {
    super(props);
  }

  render() {
    const { loading, errorMsg, items, departmentId } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No members')} />
      );
      const table = (
        <Fragment>
          <table className="table-hover">
            <thead>
              <tr>
                <th width="5%">{/* icon */}</th>
                <th width="55%">{gettext('Name')}</th>
                <th width="30%">{gettext('Role')}</th>
                <th width="10%">{/* Operations*/}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                return (<Item
                  key={index}
                  item={item}
                  departmentId={departmentId}
                  removeMember={this.props.removeMember}
                  updateMemberRole={this.props.updateMemberRole}
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

const itemPorpTypes = {
  item: PropTypes.object,
  departmentId: PropTypes.number,
  removeMember: PropTypes.func,
  updateMemberRole: PropTypes.func
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      isDeleteDialogOpen: false
    };
  }

  handleMouseEnter = () => {
    this.setState({ isOpIconShown: true });
  };

  handleMouseLeave = () => {
    this.setState({ isOpIconShown: false });
  };

  toggleDeleteDialog = (e) => {
    if (e) {
      e.preventDefault();
    }
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  removeMember = () => {
    const { item } = this.props;
    this.props.removeMember(item.email, item.name);
    this.toggleDeleteDialog();
  };

  updateMemberRole = (role) => {
    this.props.updateMemberRole(this.props.item.email, role);
  };

  getRole = () => {
    const { item } = this.props;
    if (item.role === 'Owner') {
      return gettext('Owner');
    } else if (item.role === 'Admin') {
      return gettext('Admin');
    } else {
      return gettext('Member');
    }
  };

  render() {
    let { isOpIconShown, isDeleteDialogOpen } = this.state;
    let { item, departmentId } = this.props;
    const options = getRoleOptions(['Member', 'Admin']) || [];
    const option = options.find(option => option.value === item.role) || {};
    let itemName = '<span class="op-target">' + Utils.HTMLescape(item.name) + '</span>';
    let dialogMsg = gettext('Are you sure you want to remove {placeholder} ?').replace('{placeholder}', itemName);

    let role;
    if (!departmentId) {
      if (item.role === 'Owner') {
        role = this.getRole();
      } else {
        role = (
          <ActiveStatusEditor
            isShowDropdownIcon={isOpIconShown}
            currentOption={option}
            menuOptions={options}
            onChangeOption={this.updateMemberRole}
            closeShowDropdownIcon={this.handleMouseLeave}
          />
        );
      }
    } else {
      role = this.getRole();
    }
    return (
      <Fragment>
        <tr onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td className="text-center"><img src={item.avatar_url} alt="" className="avatar" width="32" /></td>
          <td><UserLink email={item.email} name={item.name} /></td>
          <td>
            {departmentId && this.getRole()}
            {!departmentId && role}
          </td>
          <td>
            {item.role !== 'Owner' && !departmentId &&
            <IconButton
              className={`action-icon ${isOpIconShown ? '' : 'invisible'}`}
              icon="x"
              title={gettext('Remove')}
              aria-label={gettext('Remove')}
              onClick={this.toggleDeleteDialog}
            >
            </IconButton>
            }
          </td>
        </tr>
        {isDeleteDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Remove member')}
            message={dialogMsg}
            executeOperation={this.removeMember}
            confirmBtnText={gettext('Remove')}
            toggleDialog={this.toggleDeleteDialog}
          />
        }
      </Fragment>
    );
  }
}

Item.propTypes = itemPorpTypes;

const groupMembersPropTypes = {
  groupID: PropTypes.string,
  onCloseSidePanel: PropTypes.func
};

class GroupMembers extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      groupName: '',
      memberList: [],
      isAddMemberDialogOpen: false,
      orgID: -1,
      departmentId: null,
      searchValue: '',
    };
  }

  componentDidMount() {
    sysAdminServiceApi.sysAdminListGroupMembers(this.props.groupID).then((res) => {
      this.setState({
        loading: false,
        memberList: res.data.members,
        groupName: res.data.group_name,
        orgID: res.data.org_id,
        departmentId: res.data.department_id
      });
    }).catch((error) => {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
          });
          location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
        } else if (error.response.status === 404) {
          this.setState({
            loading: false,
            errorMsg: gettext('Group not found')
          });
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

  toggleAddMemgerDialog = () => {
    this.setState({ isAddMemberDialogOpen: !this.state.isAddMemberDialogOpen });
  };

  addMembers = (emails) => {
    sysAdminServiceApi.sysAdminAddGroupMember(this.props.groupID, emails).then(res => {
      let newMemberList = res.data.success;
      if (newMemberList.length) {
        newMemberList.map(item => {
          const msg = gettext('Successfully added {email_placeholder}')
            .replace('{email_placeholder}', item.email);
          toaster.success(msg);
          return item;
        });
        newMemberList = newMemberList.concat(this.state.memberList);
        this.setState({
          memberList: newMemberList
        });
      }
      res.data.failed.map(item => {
        const msg = gettext('Failed to add {email_placeholder}: {error_msg_placeholder}')
          .replace('{email_placeholder}', item.email)
          .replace('{error_msg_placeholder}', item.error_msg);
        toaster.danger(msg, { duration: 3 });
        return item;
      });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  removeMember = (email, name) => {
    sysAdminServiceApi.sysAdminDeleteGroupMember(this.props.groupID, email).then(res => {
      let newRepoList = this.state.memberList.filter(item => {
        return item.email !== email;
      });
      this.setState({
        memberList: newRepoList
      });
      toaster.success(gettext('Successfully removed {placeholder}.').replace('{placeholder}', name));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  updateMemberRole = (email, role) => {
    let isAdmin = role === 'Admin';
    sysAdminServiceApi.sysAdminUpdateGroupMemberRole(this.props.groupID, email, isAdmin).then(res => {
      let newRepoList = this.state.memberList.map(item => {
        if (item.email === email) {
          item.role = role;
        }
        return item;
      });
      this.setState({
        memberList: newRepoList
      });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onChangeSearchValue = (inputValue) => {
    const { searchValue } = this.state;
    if (searchValue === inputValue) return;
    this.setState({ searchValue: inputValue });
  };

  render() {
    let { isAddMemberDialogOpen, orgID, departmentId, memberList, groupName, searchValue } = this.state;
    const items = memberList.filter(member => member.name.indexOf(searchValue.trim()) !== -1);
    const isDesktop = Utils.isDesktop();
    let MainPanelTopbarContainer;
    if (isDesktop) {
      MainPanelTopbarContainer = (
        <MainPanelTopbar>
          {!departmentId && <Button className="btn btn-secondary operation-item" onClick={this.toggleAddMemgerDialog}>{gettext('Add member')}</Button>}
        </MainPanelTopbar>
      );
    } else {
      MainPanelTopbarContainer = (
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}>
          {!departmentId && <span className="mobile-dropdown-item dropdown-item" onClick={this.toggleAddMemgerDialog}>{gettext('Add member')}</span>}
        </MainPanelTopbar>
      );
    }
    return (
      <Fragment>
        {MainPanelTopbarContainer}
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <GroupNav
              currentItem="members"
              groupID={this.props.groupID}
              groupName={groupName}
              searchValue={searchValue}
              onChangeSearchValue={this.onChangeSearchValue}
            />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={items}
                departmentId={this.state.departmentId}
                removeMember={this.removeMember}
                updateMemberRole={this.updateMemberRole}
              />
            </div>
          </div>
        </div>
        {isAddMemberDialogOpen &&
          <SysAdminGroupAddMemberDialog
            addMembers={this.addMembers}
            toggle={this.toggleAddMemgerDialog}
            orgID={orgID}
          />
        }
      </Fragment>
    );
  }
}

GroupMembers.propTypes = groupMembersPropTypes;

export default GroupMembers;
