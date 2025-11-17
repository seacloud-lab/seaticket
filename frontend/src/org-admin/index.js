// Import React!
import React from 'react';
import { createRoot } from 'react-dom/client';
import { globalHistory, LocationProvider, Router } from '@gatsbyjs/reach-router';
import MediaQuery from 'react-responsive';
import { Modal } from 'reactstrap';
import dayjs from 'dayjs';
import { siteRoot, lang, enableMultiSAML, canUseSAML } from '@/constants';
import SidePanel from './side-panel';
import Info from './info';
import Settings from './settings';
import Projects from './projects';
import SearchProjects from './projects/search-projects';
import Users from './users';
import SearchUsers from './users/search-users';
import UserProfile from './user-profile';
import Groups from './groups';
import GroupInfo from './group-info';
import GroupProjects from './group-projects';
import GroupMembers from './group-members';
import OrgSAMLConfig from './saml';
import StatisticsAI from './statistics';
import { BAR_CONFIG, BAR_TYPE, BARS } from './constants';

import '@/css/layout.css';
import '@/css/toolbar.css';
import '@/css/admin-common.css';

dayjs.locale(lang);

class Org extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isSidePanelClosed: true,
      currentTab: 'users',
    };
  }

  componentDidMount() {
    const href = window.location.pathname.split('/');
    let currentTab = href[2];
    const bar = BARS.find(bar => bar.isActive(currentTab)) || BARS[0];
    this.setState({ currentTab: bar.value });
  }

  onCloseSidePanel = () => {
    this.setState({ isSidePanelClosed: !this.state.isSidePanelClosed });
  };

  tabItemClick = (tab) => {
    this.setState({ currentTab: tab });
  };

  render() {
    let { isSidePanelClosed, currentTab } = this.state;
    return (
      <div id="main" className="org-admin">
        <SidePanel
          isSidePanelClosed={isSidePanelClosed}
          onCloseSidePanel={this.onCloseSidePanel}
          currentTab={currentTab}
          tabItemClick={this.tabItemClick}
        />
        <div className="main-panel">
          <Router className="reach-router" role='group'>
            <Info path={BAR_CONFIG[BAR_TYPE.MANAGE].link} onCloseSidePanel={this.onCloseSidePanel} />
            <Settings path={BAR_CONFIG[BAR_TYPE.SETTINGS].link} onCloseSidePanel={this.onCloseSidePanel} />

            {/* project */}
            <Projects path={BAR_CONFIG[BAR_TYPE.PROJECTS].link} currentTab={currentTab} tabItemClick={this.tabItemClick} onCloseSidePanel={this.onCloseSidePanel}/>
            <SearchProjects path={siteRoot + 'org/search-projects'} onCloseSidePanel={this.onCloseSidePanel} />

            {/* users */}
            <Users path={siteRoot + 'org/users'} currentTab={currentTab} tabItemClick={this.tabItemClick} onCloseSidePanel={this.onCloseSidePanel} />
            <SearchUsers path={siteRoot + 'org/search-users'} onCloseSidePanel={this.onCloseSidePanel} />
            <UserProfile path={siteRoot + 'org/users/info/:email/'} onCloseSidePanel={this.onCloseSidePanel} />

            {/* groups */}
            <Groups path={siteRoot + 'org/groups'} onCloseSidePanel={this.onCloseSidePanel} />
            <GroupInfo path={siteRoot + 'org/groups/:groupID/'} onCloseSidePanel={this.onCloseSidePanel} />
            <GroupProjects path={siteRoot + 'org/groups/:groupID/projects/'} onCloseSidePanel={this.onCloseSidePanel} />
            <GroupMembers path={siteRoot + 'org/groups/:groupID/members/'} onCloseSidePanel={this.onCloseSidePanel} />

            {/* statistics */}
            <StatisticsAI path={siteRoot + 'org/statistics'} onCloseSidePanel={this.onCloseSidePanel} />

            {enableMultiSAML && canUseSAML &&
              <OrgSAMLConfig path={siteRoot + 'org/saml-config'} onCloseSidePanel={this.onCloseSidePanel} />
            }
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
    <Org />
  </LocationProvider>
);
