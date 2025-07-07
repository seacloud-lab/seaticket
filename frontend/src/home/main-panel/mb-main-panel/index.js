import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Router } from '@gatsbyjs/reach-router';
import { TabBar } from '../../../components';
import { AllWorkspaces, WorkspaceInMainPanel } from '../pc-main-panel';
import { seaQAAPI } from '../../../api/web-api.js';
import Workspace from '../../models/workspace.js';
import { gettext, siteRoot } from '../../../constants';
import MobileMine from '../../mobile/mobile-mine';
import MobileHeader from '../../mobile/mobile-header';

import './index.css';

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

  onCopyProject = (dtable) => {
    let newWorkspaceList = this.state.workspaceList.slice();
    for (let workspace of newWorkspaceList) {
      if (dtable.workspace_id === workspace.id) {
        workspace.project_list.push(dtable);
        break;
      }
    }
    this.setState({ workspaceList: newWorkspaceList });
  };

  onAddProject = (project) => {
    let newWorkspaceList = this.state.workspaceList.slice();
    newWorkspaceList = newWorkspaceList.map(item => {
      if (project.workspace_id === item.id) {
        item.project_list.push(project);
      }
      return item;
    });
    this.setState({ workspaceList: newWorkspaceList });
  };

  onDeleteProject = (deletedWorkspaceID, newProjectList) => {
    let workspaceList = this.state.workspaceList.slice(0);
    for (let i = 0; i < workspaceList.length; i++) {
      if (workspaceList[i].id === deletedWorkspaceID) {
        workspaceList[i].project_list = newProjectList;
        break;
      }
    }
    this.setState({ workspaceList });
  };

  onAddGroupSharedProject = (groupID, table) => {
    let workspaceList = this.state.workspaceList.slice();
    for (let workspace of workspaceList) {
      if (workspace.group_id === groupID) {
        workspace.group_shared_projects.push(table);
        break;
      }
    }
    this.setState({ workspaceList: workspaceList });
  };

  onLeaveGroupSharedProject = (groupID, table) => {
    let workspaceList = this.state.workspaceList.slice(0);
    for (let i = 0; i < workspaceList.length; i++) {
      if (workspaceList[i].group_id === groupID) {
        workspaceList[i].group_shared_projects = workspaceList[i].group_shared_projects.filter((item) => {return item.id !== table.id;});
        break;
      }
    }
    this.setState({ workspaceList: workspaceList });
  };

  onSelectCurrentTab = (selectedTab) => {
    this.setState({ selectedTab });
  };

  renderMainContent = () => {

    return (
      <Router className="reach-router" role='group'>
        <AllWorkspaces
          path={siteRoot}
          loadWorkspaceList={this.loadWorkspaceList}
          isWorkspaceListLoading={this.state.isWorkspaceListLoading}
          workspaceList={this.state.workspaceList}
          errorMsg={this.state.errorMsg}
          onDeleteGroup={this.onDeleteGroup}
          onDeleteProject={this.onDeleteProject}
          onCopyProject={this.onCopyProject}
          onAddGroupSharedProject={this.onAddGroupSharedProject}
          onLeaveGroupSharedProject={this.onLeaveGroupSharedProject}
          onAddProject={this.onAddProject}
          updateSidePanelGroups={this.props.updateSidePanelGroups}
        />
        <AllWorkspaces
          path={siteRoot + 'project/'}
          loadWorkspaceList={this.loadWorkspaceList}
          isWorkspaceListLoading={this.state.isWorkspaceListLoading}
          workspaceList={this.state.workspaceList}
          errorMsg={this.state.errorMsg}
          onDeleteGroup={this.onDeleteGroup}
          onDeleteProject={this.onDeleteProject}
          onCopyProject={this.onCopyProject}
          onAddGroupSharedProject={this.onAddGroupSharedProject}
          onLeaveGroupSharedProject={this.onLeaveGroupSharedProject}
          onAddProject={this.onAddProject}
          updateSidePanelGroups={this.props.updateSidePanelGroups}
        />
        <WorkspaceInMainPanel
          path={siteRoot + 'dtable/:dtableID'}
          loadWorkspaceList={this.loadWorkspaceList}
          isWorkspaceListLoading={this.state.isWorkspaceListLoading}
          workspaceList={this.state.workspaceList}
          errorMsg={this.state.errorMsg}
          onDeleteGroup={this.onDeleteGroup}
          onDeleteProject={this.onDeleteProject}
          onCopyProject={this.onCopyProject}
          onAddGroupSharedProject={this.onAddGroupSharedProject}
          onLeaveGroupSharedProject={this.onLeaveGroupSharedProject}
          onAddProject={this.onAddProject}
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
