import React from 'react';
import PropTypes from 'prop-types';
import { Router } from '@gatsbyjs/reach-router';
import homeAPI from '../../api';
import Workspace from '../../models/workspace';
import AllWorkspaces from './all-workspaces';
import WorkspaceInMainPanel from './workspace-in-main-panel';
import MyProjectsTrash from './my-projects-trash';

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
    homeAPI.listWorkspaces().then(res => {
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

  onCopyProject = (project) => {
    let newWorkspaceList = this.state.workspaceList.slice();
    for (let workspace of newWorkspaceList) {
      if (project.workspace_id === workspace.id) {
        workspace.projects.push(project);
        break;
      }
    }
    this.setState({ workspaceList: newWorkspaceList });
  };

  onAddProject = (project) => {
    let newWorkspaceList = this.state.workspaceList.slice();
    newWorkspaceList = newWorkspaceList.map(item => {
      if (project.workspace_id === item.id) {
        item.projects.push(project);
      }
      return item;
    });
    this.setState({ workspaceList: newWorkspaceList });
  };

  onDeleteProject = (deletedWorkspaceID, newTableList) => {
    let workspaceList = this.state.workspaceList.slice(0);
    for (let i = 0; i < workspaceList.length; i++) {
      if (workspaceList[i].id === deletedWorkspaceID) {
        workspaceList[i].projects = newTableList;
        break;
      }
    }
    this.setState({ workspaceList });
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
            onDeleteProject={this.onDeleteProject}
            onCopyProject={this.onCopyProject}
            onAddProject={this.onAddProject}
            updateSidePanelGroups={this.props.updateSidePanelGroups}
          />
          <AllWorkspaces
            path={siteRoot + 'projects/'}
            loadWorkspaceList={this.loadWorkspaceList}
            isWorkspaceListLoading={this.state.isWorkspaceListLoading}
            workspaceList={this.state.workspaceList}
            errorMsg={this.state.errorMsg}
            onDeleteGroup={this.onDeleteGroup}
            onDeleteProject={this.onDeleteProject}
            onCopyProject={this.onCopyProject}
            onAddProject={this.onAddProject}
            updateSidePanelGroups={this.props.updateSidePanelGroups}
          />
          <WorkspaceInMainPanel
            path={siteRoot + 'project/:projectID'}
            loadWorkspaceList={this.loadWorkspaceList}
            isWorkspaceListLoading={this.state.isWorkspaceListLoading}
            workspaceList={this.state.workspaceList}
            errorMsg={this.state.errorMsg}
            onDeleteGroup={this.onDeleteGroup}
            onDeleteProject={this.onDeleteProject}
            onCopyProject={this.onCopyProject}
            onAddProject={this.onAddProject}
            updateSidePanelGroups={this.props.updateSidePanelGroups}
          />
          <MyProjectsTrash
            path={siteRoot + 'project/trash/'}
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
