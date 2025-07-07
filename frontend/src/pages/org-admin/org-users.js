import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { navigate } from '@gatsbyjs/reach-router';
import { toaster, ModalPortal } from '../../components';
import OrgUsersList from './org-users-list';
import OrgAdminList from './org-admin-list';
import MainPanelTopbar from './main-panel-topbar';
import AddOrgAdminDialog from '../../components/dialog/org-add-admin-dialog';
import AddOrgUserDialog from '../../components/dialog/org-add-user-dialog';
import InviteUserDialog from '../../components/dialog/org-admin-invite-user-dialog';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import OrgUserInfo from '../../models/org-user';
import { gettext, invitationLink, orgID, siteRoot } from '../../constants';
import { Utils } from '../../utils/utils';
import Search from '../sys-admin/search';

class OrgUsers extends Component {

  constructor(props) {
    super(props);
    this.state = {
      orgAdminUsers: [],
      isShowAddOrgAdminDialog: false,
      orgUsers: [],
      page: 1,
      pageNext: false,
      perPage: 25,
      isShowAddOrgUserDialog: false,
      isInviteUserDialogOpen: false,
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

  toggleInviteUserDialog = () => {
    this.setState({ isInviteUserDialogOpen: !this.state.isInviteUserDialogOpen });
  };

  initOrgUsersData = (page, perPage) => {
    orgAdminServiceApi.orgAdminListOrgUsers(orgID, false, page, perPage).then(res => {
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
    orgAdminServiceApi.orgAdminAddOrgUser(orgID, email, name, password).then(res => {
      let userInfo = new OrgUserInfo(res.data);
      this.state.orgUsers.unshift(userInfo);
      this.setState({
        orgUsers: this.state.orgUsers
      });
      this.toggleAddOrgUser();
      let msg = gettext('successfully added user %s.');
      msg = msg.replace('%s', email);
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

  toggleOrgUsersDelete = (user) => {
    orgAdminServiceApi.orgAdminDeleteOrgUser(orgID, user.email).then(res => {
      let users = this.state.orgUsers.filter(item => item.email !== user.email);
      this.setState({ orgUsers: users });
      let msg = gettext('Successfully deleted %s');
      msg = msg.replace('%s', user.name);
      toaster.success(msg);
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  initOrgAdmin = () => {
    orgAdminServiceApi.orgAdminListOrgUsers(orgID, true).then(res => {
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
    orgAdminServiceApi.orgAdminDeleteOrgUser(orgID, email).then(res => {
      this.setState({
        orgAdminUsers: this.state.orgAdminUsers.filter(item => item.email !== email)
      });
      let msg = gettext('Successfully deleted %s');
      msg = msg.replace('%s', email);
      toaster.success(msg);
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  toggleRevokeAdmin = (email) => {
    orgAdminServiceApi.orgAdminSetOrgAdmin(orgID, email, false).then(res => {
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
    let msg = gettext('Successfully added %s as admin.');
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

  onChangePerPage = (e) => {
    const newPerPage = Number(e.target.value);
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
    return <Search
      placeholder={gettext('Search users')}
      submit={this.searchItems}
    />;
  };

  render() {
    const topBtn = 'btn btn-secondary operation-item';
    let topbarChildren;
    if (this.props.currentTab === 'admins') {
      topbarChildren = (
        <Fragment>
          <button className={topBtn} title={gettext('Add admin')} aria-label={gettext('Add admin')} onClick={this.toggleAddOrgAdmin}>
            <i className="dtable-font dtable-icon-add-square text-secondary mr-1"></i>{gettext('Add admin')}
          </button>
          {this.state.isShowAddOrgAdminDialog &&
            <ModalPortal>
              <AddOrgAdminDialog toggle={this.toggleAddOrgAdmin} onAddedOrgAdmin={this.onAddedOrgAdmin}/>
            </ModalPortal>
          }
        </Fragment>
      );
    } else if (this.props.currentTab === 'users') {
      topbarChildren = (
        <Fragment>
          <button className={topBtn} title={gettext('Add user')} aria-label={gettext('Add user')} onClick={this.toggleAddOrgUser}>
            <i className="dtable-font dtable-icon-add-square text-secondary mr-1"></i>{gettext('Add user')}
          </button>
          {invitationLink &&
            <button className={topBtn} title={gettext('Invite user')} aria-label={gettext('Invite user')} onClick={this.toggleInviteUserDialog}>
              <i className="dtable-font dtable-icon-add-square text-secondary mr-1"></i>{gettext('Invite user')}
            </button>
          }
          {this.state.isShowAddOrgUserDialog &&
            <ModalPortal>
              <AddOrgUserDialog handleSubmit={this.addOrgUser} toggle={this.toggleAddOrgUser}/>
            </ModalPortal>
          }
          {this.state.isInviteUserDialogOpen &&
            <ModalPortal>
              <InviteUserDialog invitationLink={invitationLink} toggle={this.toggleInviteUserDialog}/>
            </ModalPortal>
          }
        </Fragment>
      );
    }

    return (
      <Fragment>
        <MainPanelTopbar children={topbarChildren} onCloseSidePanel={this.props.onCloseSidePanel} search={this.getSearch()}/>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <div className="cur-view-path org-user-nav tab-nav-container">
              <ul className="nav">
                <li className="nav-item" onClick={() => this.tabItemClick('users')}>
                  <span className={`nav-link ${this.props.currentTab === 'users' ? 'active' : ''}`}>{gettext('All')}</span>
                </li>
                <li className="nav-item" onClick={() => this.tabItemClick('admins')}>
                  <span className={`nav-link ${this.props.currentTab === 'admins' ? 'active' : ''}`} >{gettext('Admin')}</span>
                </li>
              </ul>
            </div>
            {this.props.currentTab === 'users' &&
              <OrgUsersList
                currentTab={this.props.currentTab}
                initOrgUsersData={this.initOrgUsersData}
                toggleDelete={this.toggleOrgUsersDelete}
                orgUsers={this.state.orgUsers}
                page={this.state.page}
                pageNext={this.state.pageNext}
                perPage={this.state.perPage}
                onChangePageNum={this.onChangePageNum}
                onChangePerPage={this.onChangePerPage}
              />
            }
            {this.props.currentTab === 'admins' &&
              <OrgAdminList
                currentTab={this.props.currentTab}
                toggleDelete={this.toggleOrgAdminDelete}
                toggleRevokeAdmin={this.toggleRevokeAdmin}
                orgAdminUsers={this.state.orgAdminUsers}
                initOrgAdmin={this.initOrgAdmin}
              />
            }
          </div>
        </div>
      </Fragment>
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
