// Import React!
import React from 'react';
import { createRoot } from 'react-dom/client';
import { globalHistory, LocationProvider, Router } from '@gatsbyjs/reach-router';
import MediaQuery from 'react-responsive';
import { Modal } from 'reactstrap';
import dayjs from 'dayjs';
import { siteRoot, lang } from '../../constants';
import SidePanel from './side-panel';
import OrgUsers from './org-users';
import OrgUserProfile from './org-user-profile';
import OrgGroups from './org-groups';
import OrgGroupInfo from './org-group-info';
import OrgGroupDtables from './org-group-dtables';
import OrgGroupMembers from './org-group-members';
import OrgInfo from './org-info';
import OrgProjects from './org-projects';
import OrgSearchDTables from './org-search-dtables';
import OrgSettings from './org-admin-settings';
import OrgSearchUsers from './org-search-users';

import '../../css/layout.css';
import '../../css/toolbar.css';
import '../../css/admin-common.css';

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
    let href = window.location.href.split('/');
    let currentTab = href[href.length - 2];

    if (location.href.indexOf(`${siteRoot}org/useradmin`) !== -1) {
      currentTab = 'users';
    }
    if (location.href.indexOf(`${siteRoot}org/groupadmin`) !== -1) {
      currentTab = 'groupadmin';
    }
    if (location.href.indexOf(`${siteRoot}org/projectadmin`) !== -1) {
      currentTab = 'projects';
    }
    if (location.href.indexOf(`${siteRoot}org/settings`) !== -1) {
      currentTab = 'settings';
    }
    this.setState({ currentTab: currentTab });
  }

  onCloseSidePanel = () => {
    this.setState({ isSidePanelClosed: !this.state.isSidePanelClosed });
  };

  tabItemClick = (param) => {
    this.setState({ currentTab: param });
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
            <OrgInfo path={siteRoot + 'org/orgmanage'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgUsers path={siteRoot + 'org/useradmin'} currentTab={currentTab} tabItemClick={this.tabItemClick} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgSearchUsers path={siteRoot + 'org/search-users'} currentTab={currentTab} tabItemClick={this.tabItemClick} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgUserProfile path={siteRoot + 'org/useradmin/info/:email/'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgGroups path={siteRoot + 'org/groupadmin'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgGroupInfo path={siteRoot + 'org/groupadmin/:groupID/'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgGroupDtables path={siteRoot + 'org/groupadmin/:groupID/dtables/'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgGroupMembers path={siteRoot + 'org/groupadmin/:groupID/members/'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgProjects path={siteRoot + 'org/projectadmin'} currentTab={currentTab} tabItemClick={this.tabItemClick} onCloseSidePanel={this.onCloseSidePanel}/>
            <OrgSearchDTables path={siteRoot + 'org/search-dtables'} currentTab={currentTab} tabItemClick={this.tabItemClick} onCloseSidePanel={this.onCloseSidePanel}/>
            <OrgSettings path={siteRoot + 'org/settings'} onCloseSidePanel={this.onCloseSidePanel} />
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
