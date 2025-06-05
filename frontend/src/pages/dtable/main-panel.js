import React from 'react';
import PropTypes from 'prop-types';
import { Router } from '@gatsbyjs/reach-router';
import SystemNotification from '../../components/system-notification';
import SystemUserNotification from '../../components/system-user-notification';
import {
  MainPanelDTables, DTablesInWorkspace, MainPanelDataset, MainPanelApps,
  MainPanelTempletes, MainPanelUserGuide, MainPanelTrashDTables,
  MainPanelActivities, MainPanelInvitationLink, MainPanelWorkflowsPanel,
  MainPanelUniversalApps,
} from './index';
import MainPanelDepartmentsV2 from './main-panel-departments-v2';
import { dtableWebAPI } from '../../api/dtable-web-api';
import Workspace from './model/workspace';
import {
  cloudMode, isOrgContext, enableOrgCommonDataset, enableInviteAFriend,
  enableUserGuide, enableAddressBookV2, enableDepartmentAdminManageMemberBases,
} from '../../utils/constants';
import { isDingTalkBuiltInBrowser } from '../../components-form/utils/utils';

import '../../css/dtable-search.css';

const siteRoot = window.app.config.siteRoot;
const gettext = window.gettext;

const propTypes = {
  currentTab: PropTypes.string,
  onShowSidePanel: PropTypes.func.isRequired,
  updateSidePanelGroups: PropTypes.func,
  showWorkflow: PropTypes.bool.isRequired,
  workflowTag: PropTypes.string,
  workflowTask: PropTypes.object,
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
        workspaceList[i].group_shared_views = workspaceList[i].group_shared_views.filter((item) => {return item.view_share_id !== sharedView.view_share_id;});
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

  render() {
    const isDingTalk = isDingTalkBuiltInBrowser();
    return (
      <div className="main-panel" aria-label={gettext('Main panel')}>
        {!isDingTalk && <SystemNotification />}
        <SystemUserNotification />
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
          {(!cloudMode || (isOrgContext && enableOrgCommonDataset)) &&
            <MainPanelDataset path={siteRoot + 'common-datasets/'} loadWorkspaceList={this.loadWorkspaceList}/>
          }
          <MainPanelApps path={siteRoot + 'dtable/apps/'} />
          <MainPanelUniversalApps path={siteRoot + 'universal-apps/'} />
          <MainPanelTempletes path={siteRoot + 'dtable/templetes/'} />
          {(!isOrgContext && enableInviteAFriend) && <MainPanelInvitationLink path={siteRoot + 'invitation-link/'} />}
          <MainPanelTrashDTables path={siteRoot + 'dtable/trash/'}/>
          {enableUserGuide && <MainPanelUserGuide path={siteRoot + 'user-guide/'}/>}
          {this.props.showWorkflow && (
            <MainPanelWorkflowsPanel
              path={siteRoot + 'workflows'}
              workflowTag={this.props.workflowTag}
              workflowTask={this.props.workflowTask}
            />
          )}
          {enableAddressBookV2 && enableDepartmentAdminManageMemberBases &&
            <MainPanelDepartmentsV2
              path={siteRoot + 'departments-v2'}
            />
          }
        </Router>
      </div>
    );
  }
}

MainPanel.propTypes = propTypes;

export default MainPanel;
