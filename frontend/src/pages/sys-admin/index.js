import React from 'react';
import { createRoot } from 'react-dom/client';
import { globalHistory, LocationProvider, Router } from '@gatsbyjs/reach-router';
import MediaQuery from 'react-responsive';
import { Modal } from 'reactstrap';
import dayjs from 'dayjs';
import { siteRoot, lang } from '../../constants';
import SidePanel from './side-panel';
import MainPanel from './main-panel';
import Info from './info';

import Users from './users/users';
import AdminUsers from './users/admin-users';
import User from './users/user-info';
import UserGroups from './users/user-groups';
import SearchUsers from './users/search-users';
import WebSettings from './web-settings/web-settings';

import Orgs from './orgs/orgs';
import OrgInfo from './orgs/org-info';
import OrgUsers from './orgs/org-users';
import OrgGroups from './orgs/org-groups';
import OrgDTables from './orgs/org-dtables';
import SearchOrgs from './orgs/search-orgs';
import AllDTables from './dtables/all-dtables';

import Groups from './groups/groups';
import GroupMembers from './groups/group-members';
import SearchGroups from './groups/search-groups';
import OrgAdminUsers from './orgs/org-admin-users';

import '../../css/layout.css';
import '../../css/toolbar.css';
import '../../css/admin-common.css';

dayjs.locale(lang);

class SysAdmin extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isSidePanelClosed: true,
      currentTab: 'file-scan',
    };
  }

  componentDidMount() {
    let href = window.location.href.split('/');
    let currentTab = href[href.length - 2];

    const pageList = [
      {
        tab: 'organizations',
        urlPartList: ['organizations/', 'search-organizations/']
      },
      {
        tab: 'dtables',
        urlPartList: ['all-dtables/', 'trash-dtables/', 'search-dtables/']
      },
      {
        tab: 'groups',
        urlPartList: ['groups/', 'search-groups/']
      },
      {
        tab: 'users',
        urlPartList: ['users/', 'search-users/']
      },
    ];
    const tmpTab = this.getCurrentTabForPageList(pageList);
    currentTab = tmpTab ? tmpTab : currentTab;

    this.setState({ currentTab: currentTab });
  }

  getCurrentTabForPageList = (pageList) => {
    let urlPartList; let tab;
    const urlBase = `${siteRoot}sys/`;
    for (let i = 0, len = pageList.length; i < len; i++) {
      urlPartList = pageList[i].urlPartList;
      tab = pageList[i].tab;
      for (let j = 0, jlen = urlPartList.length; j < jlen; j++) {
        if (location.href.indexOf(`${urlBase}${urlPartList[j]}`) !== -1) {
          return tab;
        }
      }
    }
  };

  onCloseSidePanel = () => {
    this.setState({ isSidePanelClosed: !this.state.isSidePanelClosed });
  };

  tabItemClick = (param) => {
    this.setState({ currentTab: param });
  };

  render() {
    let { currentTab, isSidePanelClosed } = this.state;

    return (
      <div id="main" className="sys-admin">
        <SidePanel
          isSidePanelClosed={isSidePanelClosed}
          onCloseSidePanel={this.onCloseSidePanel}
          currentTab={currentTab}
          tabItemClick={this.tabItemClick}
        />
        <MainPanel>
          <Router className="reach-router" role='group'>
            <Info path={siteRoot + 'sys/info'} onCloseSidePanel={this.onCloseSidePanel} />
            <AllDTables path={siteRoot + 'sys/all-dtables'} onCloseSidePanel={this.onCloseSidePanel} />
            <Orgs path={siteRoot + 'sys/organizations'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgInfo path={siteRoot + 'sys/organizations/:orgID/info'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgUsers path={siteRoot + 'sys/organizations/:orgID/users'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgAdminUsers path={siteRoot + 'sys/organizations/:orgID/admin-users'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgGroups path={siteRoot + 'sys/organizations/:orgID/groups'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgDTables path={siteRoot + 'sys/organizations/:orgID/dtables'} onCloseSidePanel={this.onCloseSidePanel} />
            <SearchOrgs path={siteRoot + 'sys/search-organizations/'} onCloseSidePanel={this.onCloseSidePanel}/>
            <WebSettings path={siteRoot + 'sys/web-settings'} onCloseSidePanel={this.onCloseSidePanel} />

            <Users path={siteRoot + 'sys/users'} onCloseSidePanel={this.onCloseSidePanel} />
            <AdminUsers path={siteRoot + 'sys/users/admins'} onCloseSidePanel={this.onCloseSidePanel} />
            <User path={siteRoot + 'sys/users/:email'} onCloseSidePanel={this.onCloseSidePanel} />
            <UserGroups path={siteRoot + 'sys/users/:email/groups'} onCloseSidePanel={this.onCloseSidePanel} />
            <SearchUsers path={siteRoot + 'sys/search-users'} onCloseSidePanel={this.onCloseSidePanel} />
            <Groups path={siteRoot + 'sys/groups'} onCloseSidePanel={this.onCloseSidePanel} />
            <GroupMembers path={siteRoot + 'sys/groups/:groupID/members'} onCloseSidePanel={this.onCloseSidePanel} />
            <SearchGroups path={siteRoot + 'sys/search-groups'} onCloseSidePanel={this.onCloseSidePanel}/>
          </Router>

        </MainPanel>
        <MediaQuery query="(max-width: 767.8px)">
          <Modal isOpen={!isSidePanelClosed} toggle={this.onCloseSidePanel} contentClassName="d-none"></Modal>
        </MediaQuery>
      </div>
    );
  }
}

const root = createRoot(document.getElementById('wrapper'));
root.render(
  <LocationProvider history={globalHistory}>
    <SysAdmin />
  </LocationProvider>
);
