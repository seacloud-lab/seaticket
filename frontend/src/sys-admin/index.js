import React from 'react';
import { createRoot } from 'react-dom/client';
import { globalHistory, LocationProvider, Router } from '@gatsbyjs/reach-router';
import MediaQuery from 'react-responsive';
import { Modal } from 'reactstrap';
import dayjs from 'dayjs';
import { siteRoot, lang } from '@/constants';
import SidePanel from './side-panel';
import Info from './info';

import Users from './users/users';
import AdminUsers from './users/admin-users';
import User from './users/user-info';
import UserGroups from './users/user-groups';
import SearchUsers from './users/search-users';

import Orgs from './orgs';
import OrgInfo from './orgs/org-info';
import OrgUsers from './orgs/org-users';
import OrgGroups from './orgs/org-groups';
import OrgProjects from './orgs/org-projects';
import SearchOrgs from './orgs/search-orgs';
import AllProjects from './projects/all-projects';
import TrashProjects from './projects/trash-projects';
import SearchProjects from './projects/search-projects';

import Groups from './groups/groups';
import GroupMembers from './groups/group-members';
import SearchGroups from './groups/search-groups';
import OrgAdminUsers from './orgs/org-admin-users';

import { BARS } from './constants';

import '@/css/layout.css';
import '@/css/toolbar.css';
import '@/css/admin-common.css';

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
    const href = window.location.pathname.split('/');
    let currentTab = href[2];
    const bar = BARS.find(bar => bar.isActive(currentTab)) || BARS[0];
    this.setState({ currentTab: bar.value });

    this.setState({ currentTab: currentTab });
  }

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
        <div className="main-panel">
          <Router className="reach-router" role='group'>
            <Info path={siteRoot + 'sys/info'} onCloseSidePanel={this.onCloseSidePanel} />

            {/* projects */}
            <AllProjects path={siteRoot + 'sys/all-projects'} onCloseSidePanel={this.onCloseSidePanel} />
            <TrashProjects path={siteRoot + 'sys/trash-projects'} onCloseSidePanel={this.onCloseSidePanel}/>
            <SearchProjects path={siteRoot + 'sys/search-projects'} onCloseSidePanel={this.onCloseSidePanel}/>

            {/* users */}
            <Users path={siteRoot + 'sys/users'} onCloseSidePanel={this.onCloseSidePanel} />
            <AdminUsers path={siteRoot + 'sys/users/admins'} onCloseSidePanel={this.onCloseSidePanel} />
            <User path={siteRoot + 'sys/users/:email'} onCloseSidePanel={this.onCloseSidePanel} />
            <UserGroups path={siteRoot + 'sys/users/:email/groups'} onCloseSidePanel={this.onCloseSidePanel} />
            <SearchUsers path={siteRoot + 'sys/search-users'} onCloseSidePanel={this.onCloseSidePanel} />

            {/* groups */}
            <Groups path={siteRoot + 'sys/groups'} onCloseSidePanel={this.onCloseSidePanel} />
            <GroupMembers path={siteRoot + 'sys/groups/:groupID/members'} onCloseSidePanel={this.onCloseSidePanel} />
            <SearchGroups path={siteRoot + 'sys/search-groups'} onCloseSidePanel={this.onCloseSidePanel}/>

            {/* org */}
            <Orgs path={siteRoot + 'sys/organizations'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgInfo path={siteRoot + 'sys/organizations/:orgID/info'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgUsers path={siteRoot + 'sys/organizations/:orgID/users'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgAdminUsers path={siteRoot + 'sys/organizations/:orgID/admin-users'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgGroups path={siteRoot + 'sys/organizations/:orgID/groups'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgProjects path={siteRoot + 'sys/organizations/:orgID/projects'} onCloseSidePanel={this.onCloseSidePanel} />
            <SearchOrgs path={siteRoot + 'sys/search-organizations/'} onCloseSidePanel={this.onCloseSidePanel}/>

          </Router>

        </div>
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
