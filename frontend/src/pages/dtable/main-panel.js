import React from 'react';
import PropTypes from 'prop-types';
import { Router } from '@gatsbyjs/reach-router';
import { MainPanelDTables, DTablesInWorkspace } from './index';
import { dtableWebAPI } from '../../api/dtable-web-api';
import Workspace from './model/workspace';

import '../../css/dtable-search.css';

const siteRoot = window.app.config.siteRoot;
const gettext = window.gettext;

const propTypes = {
  currentTab: PropTypes.string,
  onShowSidePanel: PropTypes.func.isRequired,
  updateSidePanelGroups: PropTypes.func,
};

class MainPanel extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      errorMsg: null,
      workspaceList: [],
      isWorkspaceListLoading: true,
      starredDTableList: [],
    };
    this.searchTableRef = null;
  }

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

  onDeleteTable = (deletedWorkspaceID, newTableList) => {
    let workspaceList = this.state.workspaceList.slice(0);
    for (let i = 0; i < workspaceList.length; i++) {
      if (workspaceList[i].id === deletedWorkspaceID) {
        workspaceList[i].project_list = newTableList;
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
        workspaceList[i].group_shared_views = workspaceList[i].group_shared_views.filter((item) => {return item.view_share_id !== sharedView.view_share_id;});
        break;
      }
    }
    this.setState({ workspaceList: workspaceList });
  };

  onUnstarDTable = (project) => {
    let workspaceList = this.state.workspaceList.slice();
    workspaceList = workspaceList.map((item) => {
      // delete starred project item from starredWorkspace
      if (item.type === 'starred') {
        item.project_list = item.project_list.filter(projectItem => {
          return projectItem.id !== project.id;
        });
        return item;
      }
      // update the dtable starred state
      item.project_list = item.project_list.map(projectItem => {
        if (projectItem.id === project.id) {
          projectItem.starred = false;
        }
        return projectItem;
      });
      // update the dtable starred in shared module
      item.group_shared_dtables = item.group_shared_dtables.map(projectItem => {
        if (projectItem.id === project.id) {
          projectItem.starred = false;
        }
        return projectItem;
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

      return item;
    });

    this.setState({ workspaceList });
  };

  render() {
    return (
      <div className="main-panel" aria-label={gettext('Main panel')}>
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
            path={siteRoot + 'projects/'}
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
        </Router>
      </div>
    );
  }
}

MainPanel.propTypes = propTypes;

export default MainPanel;
