import React from 'react';
import { TabBar } from 'antd-mobile';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Router } from '@gatsbyjs/reach-router';
import { MainPanelDTables, DTablesInWorkspace } from '../index.js';
import { seaQAAPI } from '../../../api/web-api';
import Workspace from '../model/workspace';
import { gettext, siteRoot } from '../../../constants';
import MobileMine from './mobile-mine';
import MobileHeader from './mobile-header';

import '../../../css/mobile/mobile-main-panel.css';

const propTypes = {
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
      isWorkspaceListLoading: true,
      starredDTableList: [],
    };
  }

  onSearchedClick = (item) => {
    let url = siteRoot + 'workspace/' + item.workspace_id + '/dtable/' + item.name + '/';
    location.href = url;
  };

  loadWorkspaceList = () => {
    seaQAAPI.listWorkspaces().then(res => {
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

  onDeleteGroup = (groupID) => {
    let workspaceList = this.state.workspaceList.filter((item) => item.group_id !== groupID);
    this.setState({ workspaceList: workspaceList });
    this.props.updateSidePanelGroups(true, true);
  };

  onCopyDTable = (dtable) => {
    let newWorkspaceList = this.state.workspaceList.slice();
    for (let workspace of newWorkspaceList) {
      if (dtable.workspace_id === workspace.id) {
        workspace.project_list.push(dtable);
        break;
      }
    }
    this.setState({ workspaceList: newWorkspaceList });
  };

  onAddDTable = (project) => {
    let newWorkspaceList = this.state.workspaceList.slice();
    newWorkspaceList = newWorkspaceList.map(item => {
      if (project.workspace_id === item.id) {
        item.project_list.push(project);
      }
      return item;
    });
    this.setState({ workspaceList: newWorkspaceList });
  };

  onDeleteTable = (deletedWorkspaceID, newProjectList) => {
    let workspaceList = this.state.workspaceList.slice(0);
    for (let i = 0; i < workspaceList.length; i++) {
      if (workspaceList[i].id === deletedWorkspaceID) {
        workspaceList[i].project_list = newProjectList;
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

  onUnstarDTable = (table) => {
    let workspaceList = this.state.workspaceList.slice();
    workspaceList = workspaceList.map((item) => {
      // delete starred dtable item from starredWorkspace
      if (item.type === 'starred') {
        item.project_list = item.project_list.filter(tableItem => {
          return tableItem.id !== table.id;
        });
        return item;
      }
      // update the dtable starred state
      item.project_list = item.project_list.map(tableItem => {
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

  onStarDTable = (project) => {
    let workspaceList = this.state.workspaceList.slice();
    workspaceList = workspaceList.map((item) => {
      // add starred dtable into starredWorkspace
      if (item.type === 'starred') {
        project.starred = true;
        item.project_list.push(project);
        return item;
      }
      // update the dtable starred state
      item.project_list = item.project_list.map(projectItem => {
        if (projectItem.id === project.id) {
          projectItem.starred = true;
        }
        return projectItem;
      });
      // update the dtable starred state in shared module
      item.group_shared_dtables = item.group_shared_dtables.map(projectItem => {
        if (projectItem.id === project.id) {
          projectItem.starred = true;
        }
        return projectItem;
      });
      return item;
    });
    this.setState({ workspaceList });
  };

  onSelectCurrentTab = (selectedTab) => {
    this.setState({ selectedTab });
  };

  renderMainContent = () => {

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
          starredDTableList={this.state.starredDTableList}
          onStarDTable={this.onStarDTable}
          onUnstarDTable={this.onUnstarDTable}
          onAddDTable={this.onAddDTable}
          updateSidePanelGroups={this.props.updateSidePanelGroups}
        />
        <MainPanelDTables
          path={siteRoot + 'project/'}
          loadWorkspaceList={this.loadWorkspaceList}
          isWorkspaceListLoading={this.state.isWorkspaceListLoading}
          workspaceList={this.state.workspaceList}
          errorMsg={this.state.errorMsg}
          onDeleteGroup={this.onDeleteGroup}
          onDeleteTable={this.onDeleteTable}
          onCopyDTable={this.onCopyDTable}
          onAddGroupSharedTable={this.onAddGroupSharedTable}
          onLeaveGroupSharedTable={this.onLeaveGroupSharedTable}
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
          starredDTableList={this.state.starredDTableList}
          onStarDTable={this.onStarDTable}
          onUnstarDTable={this.onUnstarDTable}
          onAddDTable={this.onAddDTable}
          updateSidePanelGroups={this.props.updateSidePanelGroups}
        />
      </Router>
    );
  };


  getTabBarItems = () => {
    let tabBarItems = BAR_ITEMS.slice(0);
    return tabBarItems;
  };

  renderTabBarContent = () => {
    const { selectedTab } = this.state;
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
    const { selectedTab } = this.state;
    return (
      <div className={classnames('mobile-main-panel', { 'mobile-main-panel-mine': selectedTab === 'mine' })} >
        <MobileHeader
          selectedTab={selectedTab}
          searchPlaceholder={this.props.searchPlaceholder}
          onShowSidePanel={this.props.onShowSidePanel}
          onSearchedClick={this.onSearchedClick}
          loadWorkspaceList={this.loadWorkspaceList}
        />
        {selectedTab === 'mine' && <MobileMine />}
        {this.renderTabBarContent()}
      </div>
    );
  }
}

MobileMainPanel.propTypes = propTypes;

export default MobileMainPanel;
