import React from 'react';
import PropTypes from 'prop-types';
import { Router } from '@gatsbyjs/reach-router';
import { seaQAAPI } from '../../../api/web-api';
import Workspace from '../../models/workspace';
import AllWorkspaces from './all-workspaces';
import WorkspaceInMainPanel from './workspace-in-main-panel';

import '../../../css/dtable-search.css';

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
    };
    this.searchTableRef = null;
  }

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

  render() {
    return (
      <div className="main-panel" aria-label={gettext('Main panel')}>
        <Router className="reach-router" role='group'>
          <AllWorkspaces
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
            onAddDTable={this.onAddDTable}
            updateSidePanelGroups={this.props.updateSidePanelGroups}
          />
          <AllWorkspaces
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
            onAddDTable={this.onAddDTable}
            updateSidePanelGroups={this.props.updateSidePanelGroups}
          />
          <WorkspaceInMainPanel
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
export {
  AllWorkspaces,
  WorkspaceInMainPanel,
};
