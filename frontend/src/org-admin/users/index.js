import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { navigate } from '@gatsbyjs/reach-router';
import { Button } from 'reactstrap';
import { toaster, ModalPortal } from '@/components';
import Users from './users';
import Admins from './admins';
import { TopBar, Main } from '../main-panel';
import { gettext, orgID, siteRoot } from '@/constants';
import { Utils } from '@/utils/utils';
import { EnterSearchInput } from '@/components';
import orgAdminAPI from '../api';
import OrgUserInfo from '../models/org-user';
import AddAdminDialog from './add-admin-dialog';
import AddUserDialog from './add-user-dialog';
import InviteUserDialog from './invite-user-dialog';

class OrgUsers extends Component {

  constructor(props) {
    super(props);
    this.state = {
      orgAdminUsers: [],
      orgUsers: [],
      page: 1,
      pageNext: false,
      perPage: 25,
      isShowAddOrgAdminDialog: false,
      isShowAddOrgUserDialog: false,
      isShowInviteUsersDialog: false,
    };
  }

  tabItemClick = (param) => {
    this.props.tabItemClick(param);
  };

  toggleAddOrgAdmin = () => {
    this.setState({ isShowAddOrgAdminDialog: !this.state.isShowAddOrgAdminDialog });
  };

  toggleAddOrgUser = () => {
    this.setState({ isShowAddOrgUserDialog: !this.state.isShowAddOrgUserDialog });
  };

  toggleInviteUsers = () => {
    this.setState({ isShowInviteUsersDialog: !this.state.isShowInviteUsersDialog });
  };

  initOrgUsersData = (page, perPage) => {
    orgAdminAPI.orgAdminListOrgUsers(orgID, false, page, perPage).then(res => {
      let userList = res.data.user_list.map(item => {
        return new OrgUserInfo(item);
      });
      this.setState({
        orgUsers: userList,
        pageNext: res.data.page_next,
        page: res.data.page,
        perPage: res.data.per_page,
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  addOrgUser = (email, name, password) => {
    orgAdminAPI.orgAdminAddOrgUser(orgID, email, name, password).then(res => {
      let userInfo = new OrgUserInfo(res.data);
      this.state.orgUsers.unshift(userInfo);
      this.setState({
        orgUsers: this.state.orgUsers
      });
      this.toggleAddOrgUser();
      const msg = gettext('%s added').replace('%s', gettext('User %s').replace('%s', email));
      toaster.success(msg);
    }).catch(error => {
      if (error.response && error.response.status === 409) { // maybe over limit
        toaster.danger(gettext('The number of users exceeds the limit of your current plan.'));
      } else {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      }
      this.toggleAddOrgUser();
    });
  };

  inviteOrgUsers = (emails) => {
    orgAdminAPI.orgAdminInviteUsers(orgID, emails).then(res => {
      const successList = res.data.success || [];
      const failedList = res.data.failed || [];
      if (successList.length > 0) {
        const sentTo = successList.map(item => item.email).join(', ');
        const successMsg = gettext('Emails have been sent to %s').replace('%s', sentTo);
        toaster.success(successMsg);
      }
      if (failedList.length > 0) {
        const msg = failedList.map(item => {
          const errorText = item.error_msg || gettext('Failed to send');
          return gettext('%s: %s').replace('%s', item.email).replace('%s', errorText);
        }).join('\n');
        toaster.danger(msg);
      }
      this.initOrgUsersData(this.state.page, this.state.perPage);
      this.toggleInviteUsers();
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
      this.toggleInviteUsers();
    });
  };


  toggleOrgUsersDelete = (user) => {
    orgAdminAPI.orgAdminDeleteOrgUser(orgID, user.email).then(res => {
      let users = this.state.orgUsers.filter(item => item.email !== user.email);
      this.setState({ orgUsers: users });
      let msg = gettext('%s deleted');
      msg = msg.replace('%s', user.name);
      toaster.success(msg);
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  initOrgAdmin = () => {
    orgAdminAPI.orgAdminListOrgUsers(orgID, true).then(res => {
      let userList = res.data.user_list.map(item => {
        return new OrgUserInfo(item);
      });
      this.setState({ orgAdminUsers: userList });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  toggleOrgAdminDelete = (email) => {
    orgAdminAPI.orgAdminDeleteOrgUser(orgID, email).then(res => {
      this.setState({
        orgAdminUsers: this.state.orgAdminUsers.filter(item => item.email !== email)
      });
      let msg = gettext('%s deleted');
      msg = msg.replace('%s', email);
      toaster.success(msg);
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  toggleRevokeAdmin = (email) => {
    orgAdminAPI.orgAdminSetOrgAdmin(orgID, email, false).then(res => {
      this.setState({
        orgAdminUsers: this.state.orgAdminUsers.filter(item => item.email !== email)
      });
      let msg = gettext('Admin permission of user %s revoked');
      msg = msg.replace('%s', res.data.name);
      toaster.success(msg);
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onAddedOrgAdmin = (userInfo) => {
    this.state.orgAdminUsers.unshift(userInfo);
    this.setState({
      orgAdminUsers: this.state.orgAdminUsers
    });
    let msg = gettext('%s has been added as admin');
    msg = msg.replace('%s', userInfo.name);
    toaster.success(msg);
    this.toggleAddOrgAdmin();
  };

  onChangePageNum = (num) => {
    const { page: oldPage, perPage } = this.state;
    let newPage;
    if (num === 1) {
      newPage = oldPage + 1;
    } else {
      newPage = oldPage - 1;
    }
    this.setState({ page: newPage }, () => {
      this.initOrgUsersData(newPage, perPage);
    });
  };

  onChangePerPage = (newPerPage) => {
    const { perPage } = this.state;
    if (perPage === newPerPage) return;
    const newPage = 1;
    this.setState({
      perPage: newPerPage,
      page: newPage,
    }, () => {
      this.initOrgUsersData(newPage, newPerPage);
    });
  };

  searchItems = (keyword) => {
    navigate(`${siteRoot}org/search-users/?query=${encodeURIComponent(keyword)}`);
  };

  getSearch = () => {
    return (<EnterSearchInput placeholder={gettext('Search users')} onSubmit={this.searchItems} />);
  };

  render() {
    return (
      <>
        <TopBar onCloseSidePanel={this.props.onCloseSidePanel} search={this.getSearch()}>
          {this.props.currentTab === 'admins' && (
            <>
              <Button color="secondary" className="operation-item" title={gettext('Add admin')} aria-label={gettext('Add admin')} onClick={this.toggleAddOrgAdmin}>
                {gettext('Add admin')}
              </Button>
              {this.state.isShowAddOrgAdminDialog &&
                <ModalPortal>
                  <AddAdminDialog toggle={this.toggleAddOrgAdmin} onAddedOrgAdmin={this.onAddedOrgAdmin}/>
                </ModalPortal>
              }
            </>
          )}
          {this.props.currentTab === 'users' && (
            <>
              <Button color="secondary" className="operation-item" title={gettext('Add user')} aria-label={gettext('Add user')} onClick={this.toggleAddOrgUser}>
                {gettext('Add user')}
              </Button>
              <Button color="secondary" className="operation-item" title={gettext('Invite user')} aria-label={gettext('Invite user')} onClick={this.toggleInviteUsers}>
                {gettext('Invite user')}
              </Button>
              {this.state.isShowAddOrgUserDialog &&
                <ModalPortal>
                  <AddUserDialog handleSubmit={this.addOrgUser} toggle={this.toggleAddOrgUser}/>
                </ModalPortal>
              }
              {this.state.isShowInviteUsersDialog &&
                <ModalPortal>
                  <InviteUserDialog handleSubmit={this.inviteOrgUsers} toggle={this.toggleInviteUsers}/>
                </ModalPortal>
              }
            </>
          )}
        </TopBar>
        <Main
          title={(
            <ul className="nav">
              <li
                className={classnames('nav-item', { 'active': this.props.currentTab === 'users' })}
                onClick={() => this.tabItemClick('users')}
              >
                <span className={`nav-link pt-0 pb-0 ${this.props.currentTab === 'users' ? 'active' : ''}`}>
                  {gettext('All')}
                </span>
              </li>
              <li
                className={classnames('nav-item', { 'active': this.props.currentTab === 'admins' })}
                onClick={() => this.tabItemClick('admins')}
              >
                <span className={`nav-link pt-0 pb-0 ${this.props.currentTab === 'admins' ? 'active' : ''}`}>
                  {gettext('Admin')}
                </span>
              </li>
            </ul>
          )}
          titleClassName="cur-view-path org-user-nav tab-nav-container mb-4"
        >
          {this.props.currentTab === 'users' &&
            <Users
              currentTab={this.props.currentTab}
              initOrgUsersData={this.initOrgUsersData}
              toggleDelete={this.toggleOrgUsersDelete}
              users={this.state.orgUsers}
              page={this.state.page}
              pageNext={this.state.pageNext}
              perPage={this.state.perPage}
              onChangePageNum={this.onChangePageNum}
              onChangePerPage={this.onChangePerPage}
            />
          }
          {this.props.currentTab === 'admins' &&
            <Admins
              currentTab={this.props.currentTab}
              toggleDelete={this.toggleOrgAdminDelete}
              toggleRevokeAdmin={this.toggleRevokeAdmin}
              orgAdminUsers={this.state.orgAdminUsers}
              initOrgAdmin={this.initOrgAdmin}
            />
          }
        </Main>
      </>
    );
  }
}

const propTypes = {
  currentTab: PropTypes.string.isRequired,
  tabItemClick: PropTypes.func.isRequired,
  onCloseSidePanel: PropTypes.func,
};

OrgUsers.propTypes = propTypes;

export default OrgUsers;
