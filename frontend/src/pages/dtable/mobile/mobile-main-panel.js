import React from 'react';
import { TabBar } from 'antd-mobile';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Router } from '@gatsbyjs/reach-router';
import { toaster } from 'dtable-ui-component';
import { MainPanelDTables, DTablesInWorkspace, MainPanelDataset, MainPanelApps, MainPanelTempletes,
  MainPanelTrashDTables, MainPanelActivities, MainPanelInvitationLink,
  MainPanelWorkflowsPanel, MainPanelUniversalApps, MainPanelUserGuide } from '../index.js';
import { Utils } from '../../../utils/utils';
import { TASK_TYPE } from '../../../workflow/constants';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import Workspace from '../model/workspace';
import { cloudMode, isOrgContext, enableOrgCommonDataset, enableInviteAFriend, gettext, siteRoot, enableUserGuide,
  workflowHelpLink, enableUniversalApp } from '../../../utils/constants';
import MobileMine from './mobile-mine';
import MobileTemplateList from './mobile-template-list';
import IconSvg from '../../../components/icon';
import MobileHeader from './mobile-header';

import '../../../css/mobile/mobile-main-panel.css';

const propTypes = {
  isShowWorkflow: PropTypes.bool,
  searchPlaceholder: PropTypes.string,
  updateSidePanelGroups: PropTypes.func,
  onShowSidePanel: PropTypes.func,
};

const BAR_ITEMS = [
  {
    key: 'Bases',
    title: gettext('Bases'),
    icon: <span className="dtable-font dtable-icon-dtable-logo tab-item"></span>,
    selectedIcon: <span className="dtable-font dtable-icon-dtable-logo selected-tab-item"></span>
  },
  {
    key: 'Workflow',
    title: gettext('Workflow'),
    icon: <span className="dtable-font dtable-icon-workflow tab-item"></span>,
    selectedIcon: <span className="dtable-font dtable-icon-workflow selected-tab-item"></span>
  },
  {
    key: 'Apps',
    title: gettext('Apps'),
    icon: <IconSvg symbol="external-apps" className="tab-item"/>,
    selectedIcon: <IconSvg symbol="external-apps" className="selected-tab-item"/>
  },
  {
    key: 'Templates',
    title: gettext('Templates'),
    icon: <span className="dtable-font dtable-icon-templates tab-item"></span>,
    selectedIcon: <span className="dtable-font dtable-icon-templates selected-tab-item"></span>
  },
  {
    key: 'Mine',
    title: gettext('Mine'),
    icon: <span className="dtable-font dtable-icon-creator tab-item"></span>,
    selectedIcon: <span className="dtable-font dtable-icon-creator selected-tab-item"></span>
  }
];

class MobileMainPanel extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      selectedTab: 'bases',
      errorMsg: null,
      workspaceList: [],
      workflowTag: '',
      workflowTask: null,
      isWorkspaceListLoading: true,
      isWorkflowHeaderPopoverVisible: false,
      starredDTableList: [],
    };
  }

  onSearchedClick = (item) => {
    let url = siteRoot + 'workspace/' + item.workspace_id + '/dtable/' + item.name + '/';
    location.href = url;
  };

  loadWorkspaceList = () => {
    dtableWebAPI.listWorkspaces().then(res => {
      let workspaceList = res.data.workspace_list.map(item => {
        return new Workspace(item);
      });
      this.setState({
        workspaceList,
        isWorkspaceListLoading: false,
      });
    }).catch(error => {
      this.errorCallbackHandle(error);
    });
  };

  errorCallbackHandle = (error) => {
    if (error.response) {
      this.setState({
        errorMsg: gettext('Error')
      });
    } else {
      this.setState({
        errorMsg: gettext('Please check the network.')
      });
    }
  };

  clearWorkflowState = () => {
    this.setState({ workflowTag: '', workflowTask: null });
  };

  onDeleteGroup = (groupID) => {
    let workspaceList = this.state.workspaceList.filter((item) => item.group_id !== groupID);
    this.setState({ workspaceList: workspaceList });
    this.props.updateSidePanelGroups(true, true);
  };

  onCopyDTable = (dtable) => {
    let newWorkspaceList = this.state.workspaceList.slice();
    for (let workspace of newWorkspaceList) {
      if (dtable.workspace_id === workspace.id) {
        workspace.table_list.push(dtable);
        break;
      }
    }
    this.setState({ workspaceList: newWorkspaceList });
  };

  onAddDTable = (dtable) => {
    let newWorkspaceList = this.state.workspaceList.slice();
    newWorkspaceList = newWorkspaceList.map(item => {
      if (dtable.workspace_id === item.id) {
        item.table_list.push(dtable);
      }
      return item;
    });
    this.setState({ workspaceList: newWorkspaceList });
  };

  onDeleteTable = (deletedWorkspaceID, newTableList) => {
    let workspaceList = this.state.workspaceList.slice(0);
    for (let i = 0; i < workspaceList.length; i++) {
      if (workspaceList[i].id === deletedWorkspaceID) {
        workspaceList[i].table_list = newTableList;
        break;
      }
    }
    this.setState({ workspaceList });
  };

  onAddGroupSharedTable = (groupID, table) => {
    let workspaceList = this.state.workspaceList.slice();
    for (let workspace of workspaceList) {
      if (workspace.group_id === groupID) {
        workspace.group_shared_dtables.push(table);
        break;
      }
    }
    this.setState({ workspaceList: workspaceList });
  };

  onLeaveGroupSharedTable = (groupID, table) => {
    let workspaceList = this.state.workspaceList.slice(0);
    for (let i = 0; i < workspaceList.length; i++) {
      if (workspaceList[i].group_id === groupID) {
        workspaceList[i].group_shared_dtables = workspaceList[i].group_shared_dtables.filter((item) => {return item.id !== table.id;});
        break;
      }
    }
    this.setState({ workspaceList: workspaceList });
  };

  onLeaveGroupSharedView = (groupID, sharedView) => {
    let workspaceList = this.state.workspaceList.slice(0);
    for (let i = 0; i < workspaceList.length; i++) {
      if (workspaceList[i].group_id === groupID) {
        workspaceList[i].group_shared_views = workspaceList[i].group_shared_views.filter((item) => {return item.id !== sharedView.id;});
        break;
      }
    }
    this.setState({ workspaceList: workspaceList });
  };

  onUnstarDTable = (table) => {
    let workspaceList = this.state.workspaceList.slice();
    workspaceList = workspaceList.map((item) => {
      // delete starred dtable item from starredWorkspace
      if (item.type === 'starred') {
        item.table_list = item.table_list.filter(tableItem => {
          return tableItem.id !== table.id;
        });
        return item;
      }
      // update the dtable starred state
      item.table_list = item.table_list.map(tableItem => {
        if (tableItem.id === table.id) {
          tableItem.starred = false;
        }
        return tableItem;
      });
      // update the dtable starred in shared module
      item.group_shared_dtables = item.group_shared_dtables.map(tableItem => {
        if (tableItem.id === table.id) {
          tableItem.starred = false;
        }
        return tableItem;
      });

      return item;
    });

    this.setState({ workspaceList });
  };

  onStarDTable = (table) => {
    let workspaceList = this.state.workspaceList.slice();
    workspaceList = workspaceList.map((item) => {
      // add starred dtable into starredWorkspace
      if (item.type === 'starred') {
        table.starred = true;
        item.table_list.push(table);
        return item;
      }
      // update the dtable starred state
      item.table_list = item.table_list.map(tableItem => {
        if (tableItem.id === table.id) {
          tableItem.starred = true;
        }
        return tableItem;
      });
      // update the dtable starred state in shared module
      item.group_shared_dtables = item.group_shared_dtables.map(tableItem => {
        if (tableItem.id === table.id) {
          tableItem.starred = true;
        }
        return tableItem;
      });
      return item;
    });
    this.setState({ workspaceList });
  };

  onOpenWorkflowTaskByNotification = (notification) => {
    const { detail } = notification;
    const { workflow_task } = detail;
    const { task_state } = workflow_task;
    let workflowTag = '';
    let workflowTask = '';
    if (task_state === 'finished') {
      workflowTag = TASK_TYPE.HANDLED;
      const message = gettext('Permission denied or you have operated');
      toaster.danger(message);
    } else {
      workflowTag = TASK_TYPE.PENDING;
      workflowTask = workflow_task;
    }
    this.setState({ workflowTag, workflowTask, selectedTab: 'workflow' });
  };

  addDtableFromExternalLink = (externalLink) => {
    const { workspaceList } = this.state;
    const personalWorkspaceID = workspaceList.find(item => item.name === 'personal').id;
    this.setState({ isCreatedTemplateLoading: true });
    dtableWebAPI.copyExternalDtable(personalWorkspaceID, externalLink).then((res) => {
      this.onCopyDTable(res.data.dtable);
      this.setState({
        isCreatedTemplateLoading: false,
        selectedTab: 'bases'
      });
    }).catch((error) => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
      this.setState({
        isCreatedTemplateLoading: false
      });
    });
  };

  onSelectCurrentTab = (selectedTab) => {
    this.setState({ selectedTab, workflowTag: '', workflowTask: null });
  };

  renderMainContent = () => {
    const { isShowWorkflow } = this.props;

    return (
      <Router className="reach-router" role='group'>
        <MainPanelDTables
          path={siteRoot}
          loadWorkspaceList={this.loadWorkspaceList}
          isWorkspaceListLoading={this.state.isWorkspaceListLoading}
          workspaceList={this.state.workspaceList}
          errorMsg={this.state.errorMsg}
          onDeleteGroup={this.onDeleteGroup}
          onDeleteTable={this.onDeleteTable}
          onCopyDTable={this.onCopyDTable}
          onAddGroupSharedTable={this.onAddGroupSharedTable}
          onLeaveGroupSharedTable={this.onLeaveGroupSharedTable}
          onLeaveGroupSharedView={this.onLeaveGroupSharedView}
          starredDTableList={this.state.starredDTableList}
          onStarDTable={this.onStarDTable}
          onUnstarDTable={this.onUnstarDTable}
          onAddDTable={this.onAddDTable}
          updateSidePanelGroups={this.props.updateSidePanelGroups}
        />
        <MainPanelDTables
          path={siteRoot + 'dtable/'}
          loadWorkspaceList={this.loadWorkspaceList}
          isWorkspaceListLoading={this.state.isWorkspaceListLoading}
          workspaceList={this.state.workspaceList}
          errorMsg={this.state.errorMsg}
          onDeleteGroup={this.onDeleteGroup}
          onDeleteTable={this.onDeleteTable}
          onCopyDTable={this.onCopyDTable}
          onAddGroupSharedTable={this.onAddGroupSharedTable}
          onLeaveGroupSharedTable={this.onLeaveGroupSharedTable}
          onLeaveGroupSharedView={this.onLeaveGroupSharedView}
          starredDTableList={this.state.starredDTableList}
          onStarDTable={this.onStarDTable}
          onUnstarDTable={this.onUnstarDTable}
          onAddDTable={this.onAddDTable}
          updateSidePanelGroups={this.props.updateSidePanelGroups}
        />
        <DTablesInWorkspace
          path={siteRoot + 'dtable/:dtableID'}
          loadWorkspaceList={this.loadWorkspaceList}
          isWorkspaceListLoading={this.state.isWorkspaceListLoading}
          workspaceList={this.state.workspaceList}
          errorMsg={this.state.errorMsg}
          onDeleteGroup={this.onDeleteGroup}
          onDeleteTable={this.onDeleteTable}
          onCopyDTable={this.onCopyDTable}
          onAddGroupSharedTable={this.onAddGroupSharedTable}
          onLeaveGroupSharedTable={this.onLeaveGroupSharedTable}
          onLeaveGroupSharedView={this.onLeaveGroupSharedView}
          starredDTableList={this.state.starredDTableList}
          onStarDTable={this.onStarDTable}
          onUnstarDTable={this.onUnstarDTable}
          onAddDTable={this.onAddDTable}
          updateSidePanelGroups={this.props.updateSidePanelGroups}
        />
        <MainPanelActivities path={siteRoot + 'activities/'} />
        {(!cloudMode || (isOrgContext && enableOrgCommonDataset)) && <MainPanelDataset path={siteRoot + 'common-datasets/'} loadWorkspaceList={this.loadWorkspaceList}/>}
        <MainPanelApps path={siteRoot + 'dtable/apps/'} />
        <MainPanelTempletes path={siteRoot + 'dtable/templetes/'} />
        {(!isOrgContext && enableInviteAFriend) && <MainPanelInvitationLink path={siteRoot + 'invitation-link/'} />}
        <MainPanelTrashDTables path={siteRoot + 'dtable/trash/'}/>
        {isShowWorkflow && <MainPanelWorkflowsPanel path={siteRoot + 'workflows'}/>}
        <MainPanelUniversalApps path={siteRoot + 'universal-apps/'} />
        {enableUserGuide && <MainPanelUserGuide path={siteRoot + 'user-guide/'}/>}
      </Router>
    );
  };

  toggleWorkflowHeaderPopoverVisible = (isWorkflowHeaderPopoverVisible) => {
    this.setState({ isWorkflowHeaderPopoverVisible });
  };

  onWorkflowToolSelect = (opt) => {
    this.setState({ isWorkflowHeaderPopoverVisible: false });
    const value = opt.props.value;
    if (value === 'using-help') {
      window.open(workflowHelpLink);
    }
  };

  getTabBarItems = () => {
    const { isShowWorkflow } = this.props;
    let tabBarItems = BAR_ITEMS.slice(0);
    if (!isShowWorkflow) {
      tabBarItems = tabBarItems.filter(item => item.key !== 'Workflow');
    }
    if (!enableUniversalApp) {
      tabBarItems = tabBarItems.filter(item => item.key !== 'Apps');
    }
    return tabBarItems;
  };

  renderTabBarContent = () => {
    const { selectedTab, workflowTag, workflowTask } = this.state;
    let tabBarItems = this.getTabBarItems();
    return (
      <TabBar
        unselectedTintColor="#999"
        tintColor="#ED7109"
        barTintColor="white"
      >
        {tabBarItems.map(item => {
          let innerContent = null;
          let itemTabValue = item.key.toLocaleLowerCase();
          if (selectedTab === 'bases' && itemTabValue === 'bases') {
            innerContent = this.renderMainContent();
          } else if (selectedTab === 'workflow' && itemTabValue === 'workflow') {
            innerContent = (
              <MainPanelWorkflowsPanel
                isShowHeader={false}
                workflowTag={workflowTag}
                workflowTask={workflowTask}
                clearWorkflowState={this.clearWorkflowState}
              />
            );
          } else if (selectedTab === 'apps' && itemTabValue === 'apps') {
            innerContent = <MainPanelUniversalApps />;
          }
          return (
            <TabBar.Item
              title={item.title}
              key={item.key}
              icon={item.icon}
              selectedIcon={item.selectedIcon}
              selected={selectedTab === itemTabValue}
              onPress={this.onSelectCurrentTab.bind(this, itemTabValue)}
            >
              {innerContent}
            </TabBar.Item>
          );
        })}
      </TabBar>
    );
  };

  render() {
    const { selectedTab, isWorkflowHeaderPopoverVisible } = this.state;
    return (
      <div className={classnames('mobile-main-panel', { 'mobile-main-panel-mine': selectedTab === 'mine' },
        { 'mobile-main-panel-templates': selectedTab === 'templates' })} >
        <MobileHeader
          selectedTab={selectedTab}
          isWorkflowHeaderPopoverVisible={isWorkflowHeaderPopoverVisible}
          searchPlaceholder={this.props.searchPlaceholder}
          onShowSidePanel={this.props.onShowSidePanel}
          onSearchedClick={this.onSearchedClick}
          onOpenWorkflowTaskByNotification={this.onOpenWorkflowTaskByNotification}
          loadWorkspaceList={this.loadWorkspaceList}
          onWorkflowToolSelect={this.onWorkflowToolSelect}
          toggleWorkflowHeaderPopoverVisible={this.toggleWorkflowHeaderPopoverVisible}
        />
        {selectedTab === 'mine' && <MobileMine />}
        {selectedTab === 'templates' &&
          <MobileTemplateList
            isSinglePage={false}
            addDtableFromExternalLink={this.addDtableFromExternalLink}
            isCreatedTemplateLoading={this.state.isCreatedTemplateLoading}
          />
        }
        {this.renderTabBarContent()}
      </div>
    );
  }
}

MobileMainPanel.propTypes = propTypes;

export default MobileMainPanel;
