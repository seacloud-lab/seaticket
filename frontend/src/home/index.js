import React, { Fragment } from 'react';
import { globalHistory, LocationProvider, navigate } from '@gatsbyjs/reach-router';
import { createRoot } from 'react-dom/client';
import MediaQuery from 'react-responsive';
import { Modal } from 'reactstrap';
import { siteRoot } from '../constants';
import Header from './header';
import SidePanel from './side-panel';
import { Utils } from '../utils/utils';
import MainPanel from './main-panel';
import { NotificationProvider } from '@/components/common/notification/hooks/notification';
import homeAPI from './api.js';
import Workspace from './models/workspace.js';

import '../css/layout.css';
import '../css/side-panel.css';
import './home.css';
import '@/css/toolbar.css';

const gettext = window.gettext;

class Home extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      currentTab: null,
      isSidePanelClosed: true,
      isUpdateSidePanelGroups: false,
      isOpenGroupExpanded: false,
      workspaceList: [],
      groupItems: [],
      isWorkspaceListLoading: true,
      errorMsg: null,
    };
    this.isDesktop = Utils.isDesktop();
  }

  componentDidMount() {
    const selectedTabs = [
      'project/trash'
    ];
    let currentTab = selectedTabs.find(tab => {
      return location.href.indexOf(`${siteRoot}${tab}`) > -1;
    });

    currentTab = currentTab ? currentTab : 'project';

    const { pathname } = location;
    const mainPath = `${siteRoot}${currentTab}`;
    const mainPathIndex = pathname.indexOf(mainPath);
    if (mainPathIndex > -1) {
      if (mainPath.indexOf('project') > -1) {
        let projectID = pathname.slice(mainPathIndex + mainPath.length, pathname.length - 1);
        if (projectID) {
          currentTab = `${currentTab}${projectID}`;
          this.setState({ isOpenGroupExpanded: true });
        }
      }
    }
    this.setState({ currentTab });
  }

  onTabClick = (tab) => {
    if (tab !== this.state.currentTab) {
      this.setState({ currentTab: tab });
    }
  };

  toggleSidePanel = () => {
    this.setState({
      isSidePanelClosed: !this.state.isSidePanelClosed
    });
  };

  toggleGroupExpanded = () => {
    this.setState({ isOpenGroupExpanded: !this.state.isOpenGroupExpanded });
  };

  updateSidePanelGroups = (status, isDeleteGroup) => {
    if (isDeleteGroup) {
      this.setState({ currentTab: 'project' });
      let { pathname, href } = location;
      let paths = pathname.split('/');
      paths = paths.filter(item => item !== '');
      if (paths[paths.length - 2] === 'project') {
        let newURL = href.slice(0, href.indexOf('/project/') + 8);
        navigate(newURL);
      }
    }
    this.setState({ isUpdateSidePanelGroups: status });
  };

  loadWorkspaceList = () => {
    homeAPI.listWorkspaces().then(res => {
      let workspaceList = res.data.workspace_list.map(item => new Workspace(item));
      let groupItems = workspaceList.filter(workspace => workspace.type === 'group');
      this.setState({
        workspaceList,
        groupItems,
        isWorkspaceListLoading: false,
      });
      console.log(groupItems);
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
    this.updateSidePanelGroups(true, true);
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

  onDeleteProject = (deletedWorkspaceID, newProjectList) => {
    let workspaceList = this.state.workspaceList.slice(0);
    for (let i = 0; i < workspaceList.length; i++) {
      if (workspaceList[i].id === deletedWorkspaceID) {
        workspaceList[i].projects = newProjectList;
        break;
      }
    }
    this.setState({ workspaceList });
  };

  render() {
    let { isSidePanelClosed, currentTab, isOpenGroupExpanded, isUpdateSidePanelGroups } = this.state;
    return (
      <Fragment>
        <NotificationProvider>
          {this.isDesktop && (<Header currentTab={currentTab} />)}
          <div id="main">
            {currentTab && (
              <SidePanel
                currentTab={currentTab}
                isSidePanelClosed={isSidePanelClosed}
                isUpdateSidePanelGroups={isUpdateSidePanelGroups}
                isOpenGroupExpanded={isOpenGroupExpanded}
                onCloseSidePanel={this.toggleSidePanel}
                onTabClick={this.onTabClick}
                updateSidePanelGroups={this.updateSidePanelGroups}
                toggleGroupExpanded={this.toggleGroupExpanded}
                isDesktop={this.isDesktop}
                workspaceList={this.state.workspaceList}
                isWorkspaceListLoading={this.state.isWorkspaceListLoading}
                onDeleteGroup={this.onDeleteGroup}
                onCopyProject={this.onCopyProject}
                onAddProject={this.onAddProject}
                onDeleteProject={this.onDeleteProject}
                loadWorkspaceList={this.loadWorkspaceList}
                groupItems={this.state.groupItems}
              />
            )}
            <MainPanel
              isDesktop={this.isDesktop}
              currentTab={currentTab}
              onShowSidePanel={this.toggleSidePanel}
              updateSidePanelGroups={this.updateSidePanelGroups}
              workspaceList={this.state.workspaceList}
              isWorkspaceListLoading={this.state.isWorkspaceListLoading}
              loadWorkspaceList={this.loadWorkspaceList}
              onDeleteGroup={this.onDeleteGroup}
              onCopyProject={this.onCopyProject}
              onAddProject={this.onAddProject}
              onDeleteProject={this.onDeleteProject}
              errorMsg={this.state.errorMsg}
            />
            <MediaQuery query="(max-width: 767.8px)">
              <Modal isOpen={!isSidePanelClosed} toggle={this.toggleSidePanel} contentClassName="d-none"></Modal>
            </MediaQuery>
          </div>
        </NotificationProvider>
      </Fragment>
    );
  }
}

const root = createRoot(document.getElementById('wrapper'));
root.render(
  <LocationProvider history={globalHistory}>
    <Home />
  </LocationProvider>
);
