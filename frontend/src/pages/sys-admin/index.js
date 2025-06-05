import React from 'react';
import { createRoot } from 'react-dom/client';
import { globalHistory, LocationProvider, Router } from '@gatsbyjs/reach-router';
import MediaQuery from 'react-responsive';
import { Modal } from 'reactstrap';
import dayjs from 'dayjs';
import { siteRoot, lang } from '../../utils/constants';
import SidePanel from './side-panel';
import MainPanel from './main-panel';
import WorkWeixinDepartments from './work-weixin-departments';
import Info from './info';

import Users from './users/users';
import AdminUsers from './users/admin-users';
import User from './users/user-info';
import UserGroups from './users/user-groups';
import UserDTables from './users/user-dtables';
import UserSharedDTables from './users/user-shared-dtables';
import UserStorage from './users/user-storages';
import SearchUsers from './users/search-users';

import StatisticsUsers from './statistic/statistic-users';
import StatisticRunScripts from './statistic/statistic-run-scripts';
import WebSettings from './web-settings/web-settings';

import Orgs from './orgs/orgs';
import OrgInfo from './orgs/org-info';
import OrgUsers from './orgs/org-users';
import OrgGroups from './orgs/org-groups';
import OrgDTables from './orgs/org-dtables';
import SearchOrgs from './orgs/search-orgs';
import OrgBigDataStorage from './orgs/org-big-data-storage';

import AllDTables from './dtables/all-dtables';
import TrashDTables from './dtables/trash-dtables';

import AllApps from './apps/all-apps';
import AllForms from './forms/all-forms';

import Groups from './groups/groups';
import GroupMembers from './groups/group-members';
import GroupStorages from './groups/group-storages';
import GroupDTables from './groups/group-dtables';
import SearchGroups from './groups/search-groups';

import Departments from './departments';

import DepartmentsV2 from './departments-v2/departments-v2';

import ExternalLinks from './external-links/external-links';
import SearchExternalLinks from './external-links/search-external-links';

import Notifications from './notifications/notifications';

import LoginLogs from './audit-logs/login-logs';
import AuditLogs from './audit-logs/action-logs';
import FileAccessLogs from './audit-logs/file-access-logs';
import AdminOperationLogs from './admin-logs/operation-logs';
import AdminLoginLogs from './admin-logs/login-logs';

import Plugins from './plugins';

import AbuseReports from './abuse-reports/abuse-reports';

import UserNotifications from './notifications/user-notifications';
import AllCollectionTables from './forms/all-collection-tables';
import ViewExternalLinks from './external-links/view-external-links';
import SearchViewExternalLinks from './external-links/search-view-external-links';
import SearchDTables from './dtables/search-dtables';
import SearchApps from './apps/search-apps';
import NotificationRules from './notification-rules/notification-rules';
import InvalidNotificationRules from './notification-rules/invalid-notification-rules';

import EmailSendingLogs from './email-sending-logs/email-sending-logs';
import PluginsInstallCount from './plugins/plugins_install_count';
import AutomationRules from './notification-rules/automation-rules';
import InvalidAutomationRules from './notification-rules/invalid-automation-rules';
import StatisticAutoRules from './statistic/statistic-auto-rules';
import StatisticExternalApps from './statistic/statistic-external-apps';
import DTableArchives from './dtables/dtable-archives';
import PeriodicalSyncs from './common-datasets/periodical-syncs';
import CommonDatasets from './common-datasets/common-datasets';
import InvalidCommonDatasetSyncs from './common-datasets/invalid-common-dataset-syncs';
import OrgAdminUsers from './orgs/org-admin-users';
import OrgUniversalApps from './orgs/org-universal-apps';
import OrgExternalLinks from './orgs/org-external-links';
import OrgViewExternalLinks from './orgs/org-view-external-links';
import Workflows from './workflows/workflows';
import OrgExternalApps from './orgs/org-external-apps';
import AllVirusFiles from './virus-scan/all-virus-files';
import UnhandledVirusFiles from './virus-scan/unhandled-virus-files';

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
        tab: 'apps',
        urlPartList: ['all-apps/', 'search-apps/']
      },
      {
        tab: 'forms',
        urlPartList: ['all-forms/']
      },
      {
        tab: 'groups',
        urlPartList: ['groups/', 'search-groups/']
      },
      {
        tab: 'externalLinks',
        urlPartList: ['external-links/', 'view-external-links/']
      },
      {
        tab: 'notifications',
        urlPartList: ['notifications/']
      },
      {
        tab: 'notification-rules',
        urlPartList: ['notification-rules/', 'invalid-notification-rules/']
      },
      {
        tab: 'common-datasets',
        urlPartList: ['common-datasets/', 'periodical-syncs/', 'invalid-syncs']
      },
      {
        tab: 'auditlogs',
        urlPartList: ['audit-logs/']
      },
      {
        tab: 'file-access-logs',
        urlPartList: ['file-access-logs/']
      },
      {
        tab: 'adminLogs',
        urlPartList: ['admin-logs/']
      },
      {
        tab: 'users',
        urlPartList: ['users/', 'search-users/']
      },
      {
        tab: 'statistics',
        urlPartList: ['statistics/users', 'statistics/scripts-running']
      },
      {
        tab: 'sys-plugins',
        urlPartList: ['plugins/', 'plugins-install-count/']
      },
      {
        tab: 'abuse-reports',
        urlPartList: ['abuse-reports/']
      },
      {
        tab: 'departments',
        urlPartList: ['departments/']
      },
      {
        tab: 'departments-v2',
        urlPartList: ['departments-v2/']
      },
      {
        tab: 'email-sending-logs',
        urlPartList: ['email-sending-logs/']
      },
      {
        tab: 'external-apps',
        urlPartList: ['external-apps/']
      },
      {
        tab: 'workflows',
        urlPartList: ['workflows/']
      },
      {
        tab: 'virus-files',
        urlPartList: ['virus-files/']
      }
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
            <TrashDTables path={siteRoot + 'sys/trash-dtables'}></TrashDTables>
            <DTableArchives path={siteRoot + 'sys/database-storage'}></DTableArchives>
            <AllApps path={siteRoot + 'sys/all-apps'} onCloseSidePanel={this.onCloseSidePanel}/>
            <AllForms path={siteRoot + 'sys/all-forms'} onCloseSidePanel={this.onCloseSidePanel}/>
            <AllCollectionTables path={siteRoot + 'sys/all-collection-tables'} onCloseSidePanel={this.onCloseSidePanel}/>
            <Orgs path={siteRoot + 'sys/organizations'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgBigDataStorage path={siteRoot + 'sys/organizations/big-data-storage'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgUniversalApps path={siteRoot + 'sys/organizations/universal-apps'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgInfo path={siteRoot + 'sys/organizations/:orgID/info'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgUsers path={siteRoot + 'sys/organizations/:orgID/users'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgAdminUsers path={siteRoot + 'sys/organizations/:orgID/admin-users'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgGroups path={siteRoot + 'sys/organizations/:orgID/groups'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgDTables path={siteRoot + 'sys/organizations/:orgID/dtables'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgExternalApps path={siteRoot + 'sys/organizations/:orgID/external-apps'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgExternalLinks path={siteRoot + 'sys/organizations/:orgID/external-links'} onCloseSidePanel={this.onCloseSidePanel} />
            <OrgViewExternalLinks path={siteRoot + 'sys/organizations/:orgID/view-external-links'} onCloseSidePanel={this.onCloseSidePanel} />
            <SearchOrgs path={siteRoot + 'sys/search-organizations/'} onCloseSidePanel={this.onCloseSidePanel}/>

            <StatisticsUsers path={siteRoot + 'sys/statistics/users/'} onCloseSidePanel={this.onCloseSidePanel} />
            <StatisticRunScripts path={siteRoot + 'sys/statistics/scripts-running/'} onCloseSidePanel={this.onCloseSidePanel} />
            <StatisticAutoRules path={siteRoot + 'sys/statistics/auto-rules/'} onCloseSidePanel={this.onCloseSidePanel} />
            <StatisticExternalApps path={siteRoot + 'sys/statistics/external-apps/'} onCloseSidePanel={this.onCloseSidePanel} />
            <WebSettings path={siteRoot + 'sys/web-settings'} onCloseSidePanel={this.onCloseSidePanel} />

            <Users path={siteRoot + 'sys/users'} onCloseSidePanel={this.onCloseSidePanel} />
            <AdminUsers path={siteRoot + 'sys/users/admins'} onCloseSidePanel={this.onCloseSidePanel} />
            <User path={siteRoot + 'sys/users/:email'} onCloseSidePanel={this.onCloseSidePanel} />
            <UserGroups path={siteRoot + 'sys/users/:email/groups'} onCloseSidePanel={this.onCloseSidePanel} />
            <UserDTables path={siteRoot + 'sys/users/:email/dtables'} onCloseSidePanel={this.onCloseSidePanel} />
            <UserSharedDTables path={siteRoot + 'sys/users/:email/shared-dtables'} onCloseSidePanel={this.onCloseSidePanel} />
            <UserStorage path={siteRoot + 'sys/users/:email/storage/*'} onCloseSidePanel={this.onCloseSidePanel} />
            <SearchUsers path={siteRoot + 'sys/search-users'} onCloseSidePanel={this.onCloseSidePanel} />
            <SearchDTables path={siteRoot + 'sys/search-dtables'} onCloseSidePanel={this.onCloseSidePanel} />
            <SearchApps path={siteRoot + 'sys/search-apps'} onCloseSidePanel={this.onCloseSidePanel} />
            <WorkWeixinDepartments
              path={siteRoot + 'sys/work-weixin'}
              currentTab={currentTab}
              tabItemClick={this.tabItemClick}
              onCloseSidePanel={this.onCloseSidePanel}
            />
            <Groups path={siteRoot + 'sys/groups'} onCloseSidePanel={this.onCloseSidePanel} />
            <GroupDTables path={siteRoot + 'sys/groups/:groupID/dtables'} onCloseSidePanel={this.onCloseSidePanel} />
            <GroupMembers path={siteRoot + 'sys/groups/:groupID/members'} onCloseSidePanel={this.onCloseSidePanel} />
            <GroupStorages path={siteRoot + 'sys/groups/:groupID/storages/*'} onCloseSidePanel={this.onCloseSidePanel} />

            <Departments path={siteRoot + 'sys/departments/*'} onCloseSidePanel={this.onCloseSidePanel} />

            <DepartmentsV2 path={siteRoot + 'sys/departments-v2'} onCloseSidePanel={this.onCloseSidePanel} />

            <ExternalLinks path={siteRoot + 'sys/external-links'} onCloseSidePanel={this.onCloseSidePanel} />
            <ViewExternalLinks path={siteRoot + 'sys/view-external-links'} onCloseSidePanel={this.onCloseSidePanel} />
            <SearchExternalLinks path={siteRoot + 'sys/search-external-links'} onCloseSidePanel={this.onCloseSidePanel} />
            <SearchViewExternalLinks path={siteRoot + 'sys/search-view-external-links'} onCloseSidePanel={this.onCloseSidePanel} />

            <SearchGroups path={siteRoot + 'sys/search-groups'} onCloseSidePanel={this.onCloseSidePanel}/>

            <Notifications path={siteRoot + 'sys/notifications'} onCloseSidePanel={this.onCloseSidePanel} />
            <UserNotifications path={siteRoot + 'sys/user-notifications'} onCloseSidePanel={this.onCloseSidePanel} />
            <LoginLogs path={siteRoot + 'sys/logs/login'} onCloseSidePanel={this.onCloseSidePanel}/>
            <AuditLogs path={siteRoot + 'sys/audit-logs'} onCloseSidePanel={this.onCloseSidePanel}/>
            <FileAccessLogs path={siteRoot + 'sys/file-access-logs'} onCloseSidePanel={this.onCloseSidePanel}/>
            <AdminOperationLogs path={siteRoot + 'sys/admin-logs/operation'} onCloseSidePanel={this.onCloseSidePanel} />
            <AdminLoginLogs path={siteRoot + 'sys/admin-logs/login'} onCloseSidePanel={this.onCloseSidePanel} />
            <Plugins path={siteRoot + 'sys/plugins'} onCloseSidePanel={this.onCloseSidePanel} />
            <PluginsInstallCount path={siteRoot + 'sys/plugins-install-count'} onCloseSidePanel={this.onCloseSidePanel} />
            <AbuseReports path={siteRoot + 'sys/abuse-reports'} onCloseSidePanel={this.onCloseSidePanel} />
            <NotificationRules path={siteRoot + 'sys/notification-rules'} onCloseSidePanel={this.onCloseSidePanel} />
            <AutomationRules path={siteRoot + 'sys/automation-rules'} onCloseSidePanel={this.onCloseSidePanel} />
            <InvalidNotificationRules path={siteRoot + 'sys/invalid-notification-rules'} onCloseSidePanel={this.onCloseSidePanel} />
            <InvalidAutomationRules path={siteRoot + 'sys/invalid-automation-rules'} onCloseSidePanel={this.onCloseSidePanel} />
            <EmailSendingLogs path={siteRoot + 'sys/email-sending-logs'} onCloseSidePanel={this.onCloseSidePanel} />

            <CommonDatasets path={siteRoot + 'sys/common-datasets'} onCloseSidePanel={this.onCloseSidePanel} />
            <PeriodicalSyncs path={siteRoot + 'sys/periodical-syncs'} onCloseSidePanel={this.onCloseSidePanel} />
            <InvalidCommonDatasetSyncs path={siteRoot + 'sys/invalid-syncs'} onCloseSidePanel={this.onCloseSidePanel} />
            <Workflows path={siteRoot + 'sys/workflows'} onCloseSidePanel={this.onCloseSidePanel} />

            <AllVirusFiles path={siteRoot + 'sys/virus-files/all'} onCloseSidePanel={this.onCloseSidePanel} />
            <UnhandledVirusFiles path={siteRoot + 'sys/virus-files/unhandled'} onCloseSidePanel={this.onCloseSidePanel} />
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
