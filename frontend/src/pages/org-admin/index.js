// Import React!
import React from 'react';
import { createRoot } from 'react-dom/client';
import { globalHistory, LocationProvider, Router } from '@gatsbyjs/reach-router';
import MediaQuery from 'react-responsive';
import { Modal } from 'reactstrap';
import dayjs from 'dayjs';
import { siteRoot, lang, enableOrgDepartment, enableAddressBookV2, disableAddressBookV1, enableMultiSAML, canUseSAML } from '../../utils/constants';
import SidePanel from './side-panel';
import OrgUsers from './org-users';
import OrgUserProfile from './org-user-profile';
import OrgGroups from './org-groups';
import OrgGroupInfo from './org-group-info';
import OrgGroupDtables from './org-group-dtables';
import OrgGroupMembers from './org-group-members';
import OrgInfo from './org-info';
import OrgDepartments from './org-departments';
import OrgDepartmentsV2 from './org-departments-v2/org-departments-v2';
import OrgDTables from './org-dtables';
import OrgSearchDTables from './org-search-dtables';
import OrgSettings from './org-admin-settings';
import OrgSubscription from './org-subscription';
import OrgWorkWeixin from './org-work-weixin';
import OrgDingtalk from './org-dingtalk';
import OrgExternalLinks from './org-external-links';
import OrgSearchUsers from './org-search-users';
import OrgAdminOperationLogs from './org-admin-operation-logs';
import OrgSAMLConfig from './org-saml-config';
import LoginLogs from './audit-logs/login-logs';
import AuditLogs from './audit-logs/action-logs';
import FileAccessLogs from './audit-logs/file-access-logs';


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
    if (location.href.indexOf(`${siteRoot}org/departmentadmin`) !== -1) {
      currentTab = 'departmentadmin';
    }
    if (location.href.indexOf(`${siteRoot}org/departmentadmin-v2`) !== -1) {
      currentTab = 'departmentadmin-v2';
    }
    if (location.href.indexOf(`${siteRoot}org/dtableadmin`) !== -1) {
      currentTab = 'bases';
    }
    if (location.href.indexOf(`${siteRoot}org/settings`) !== -1) {
      currentTab = 'settings';
    }
    if (location.href.indexOf(`${siteRoot}org/work-weixin`) !== -1) {
      currentTab = 'work-weixin';
    }
    if (location.href.indexOf(`${siteRoot}org/external-link`) !== -1) {
      currentTab = 'dtablelinkex';
    }
    if (location.href.indexOf(`${siteRoot}org/admin-logs`) !== -1) {
      currentTab = 'adminlogs';
    }
    if (location.href.indexOf(`${siteRoot}org/login-logs`) !== -1) {
      currentTab = 'loginlogs';
    }
    if (location.href.indexOf(`${siteRoot}org/audit-logs`) !== -1) {
      currentTab = 'auditlogs';
    }
    if (location.href.indexOf(`${siteRoot}org/file-access-logs`) !== -1) {
      currentTab = 'file-access-logs';
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
            <OrgAdminOperationLogs path={siteRoot + 'org/admin-logs/operation/'} onCloseSidePanel={this.onCloseSidePanel} />
            <LoginLogs path={siteRoot + 'org/login-logs/'} onCloseSidePanel={this.onCloseSidePanel} />
            <AuditLogs path={siteRoot + 'org/audit-logs'} onCloseSidePanel={this.onCloseSidePanel} />
            <FileAccessLogs path={siteRoot + 'org/file-access-logs'} onCloseSidePanel={this.onCloseSidePanel} />
            {enableOrgDepartment && !disableAddressBookV1 && (
              <OrgDepartments path={siteRoot + 'org/departmentadmin/*'} onCloseSidePanel={this.onCloseSidePanel}/>
            )}
            {enableOrgDepartment && enableAddressBookV2 && (
              <OrgDepartmentsV2 path={siteRoot + 'org/departmentadmin-v2/*'} onCloseSidePanel={this.onCloseSidePanel}/>
            )}
            <OrgDTables path={siteRoot + 'org/dtableadmin'} currentTab={currentTab} tabItemClick={this.tabItemClick} onCloseSidePanel={this.onCloseSidePanel}/>
            <OrgSearchDTables path={siteRoot + 'org/search-dtables'} currentTab={currentTab} tabItemClick={this.tabItemClick} onCloseSidePanel={this.onCloseSidePanel}/>
            <OrgExternalLinks path={siteRoot + 'org/external-link'} currentTab={currentTab} tabItemClick={this.tabItemClick} onCloseSidePanel={this.onCloseSidePanel}/>
            <OrgSettings path={siteRoot + 'org/settings'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgSubscription path={siteRoot + 'org/subscription'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgWorkWeixin path={siteRoot + 'org/work-weixin'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgDingtalk path={siteRoot + 'org/dingtalk'} onCloseSidePanel={this.onCloseSidePanel} />
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
