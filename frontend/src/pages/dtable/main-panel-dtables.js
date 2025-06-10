import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import Loading from '../../components/loading';
import { gettext, canAddGroup, isOrgContext, orgName } from '../../utils/constants';
import DTableWorkspaceCommon from './dtable-workspace-common';
import DTableWorkspaceShared from './dtable-workspace-shared';
import CreateDtableGroupDialog from './dialog/create-dtable-group-dialog';
import { Utils } from '../../utils/utils';
import SessionStorage from '../../utils/session-utils';
import DTableWorkspaceStarred from './dtable-workspace-starred';

const propTypes = {
  isWorkspaceListLoading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  workspaceList: PropTypes.array.isRequired,
  loadWorkspaceList: PropTypes.func.isRequired,
  onDeleteGroup: PropTypes.func.isRequired,
  onCopyDTable: PropTypes.func.isRequired,
  onDeleteTable: PropTypes.func.isRequired,
  onLeaveGroupSharedTable: PropTypes.func.isRequired,
  onAddGroupSharedTable: PropTypes.func.isRequired,
  onLeaveGroupSharedView: PropTypes.func.isRequired,
  onStarDTable: PropTypes.func.isRequired,
  onUnstarDTable: PropTypes.func.isRequired,
  onAddDTable: PropTypes.func.isRequired,
  updateSidePanelGroups: PropTypes.func.isRequired,
};

class MainPanelDTables extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowCreateGroupDialog: false,
    };
    this.sessionStorage = new SessionStorage();
  }

  componentDidMount() {
    this.props.loadWorkspaceList();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.props.isWorkspaceListLoading !== nextProps.isWorkspaceListLoading) {
      this.initScrollTop();
    }
  }

  onCreateGroupToggle = () => {
    this.setState({ isShowCreateGroupDialog: !this.state.isShowCreateGroupDialog });
  };

  onCreateGroup = () => {
    this.props.loadWorkspaceList();
    this.onCreateGroupToggle();
    this.props.updateSidePanelGroups(true);
  };

  renameGroupName = () => {
    this.props.loadWorkspaceList();
    this.props.updateSidePanelGroups(true);
  };

  initScrollTop = () => {
    const scrollTop = this.sessionStorage.getItem('view-content-scroll-top');
    // setTimeout 0 to make sure dom is rendered
    setTimeout(() => {
      if (scrollTop && this.viewContent) {
        this.viewContent.scrollTop = scrollTop;
      }
    }, 0);
  };

  onScroll = () => {
    const scrollTop = this.viewContent.scrollTop;
    this.sessionStorage.setItem('view-content-scroll-top', scrollTop);
  };

  render() {
    let { isWorkspaceListLoading, workspaceList, errorMsg, onCopyDTable,
      onDeleteTable, onDeleteGroup, onAddGroupSharedTable, onLeaveGroupSharedTable,
      onLeaveGroupSharedView, onStarDTable, onUnstarDTable, onAddDTable } = this.props;
    if (isWorkspaceListLoading) {
      return (<div className="mt-6"><Loading /></div>);
    }

    let personalWorkspace = workspaceList.find(workspace => {
      return workspace.type === 'personal';
    });

    let starredWorkspace = workspaceList.find(workspace => {
      return workspace.type === 'starred';
    });

    let sharedWorkspace = workspaceList.find(workspace => {
      return workspace.type === 'shared';
    });

    let groupWorkspaceList = workspaceList.filter(workspace => {
      return workspace.type === 'group';
    });

    const isDesktop = Utils.isDesktop();

    return (
      <Fragment>
        <div className="main-panel-center dtable-center">
          <div className="cur-view-container d-flex flex-1 flex-column">
            <div
              className={`${isDesktop ? '' : 'p-0'} cur-view-content`}
              onScroll={Utils.debounce(this.onScroll)}
              ref={ref => this.viewContent = ref}
            >
              {isOrgContext &&
                <div className={`py-4 dtable-org-title ${isDesktop ? '' : 'dtable-mobile-org-title'}`}>
                  <i aria-hidden="true" className="dtable-org-icon dtable-font dtable-icon-organization-name"></i>
                  <h1 title={orgName} aria-label={orgName} className="dtable-org-name">{orgName}</h1>
                </div>
              }
              {errorMsg && <p className="error text-center">{errorMsg}</p>}
              {!errorMsg && (
                <Fragment>
                  {personalWorkspace &&
                    <DTableWorkspaceCommon
                      workspace={personalWorkspace}
                      onCopyDTable={onCopyDTable}
                      onDeleteTable={onDeleteTable}
                      onAddGroupSharedTable={onAddGroupSharedTable}
                      onLeaveGroupSharedTable={onLeaveGroupSharedTable}
                      onStarDTable={onStarDTable}
                      onUnstarDTable={onUnstarDTable}
                      onAddDTable={onAddDTable}
                      loadWorkspaceList={this.props.loadWorkspaceList}
                    />
                  }
                  {starredWorkspace && (
                    <DTableWorkspaceStarred
                      starredWorkspace={starredWorkspace}
                      onUnstarDTable={onUnstarDTable}
                      personalWorkspace={personalWorkspace}
                      groupWorkspaceList={groupWorkspaceList}
                    />
                  )}
                  {sharedWorkspace &&
                    <DTableWorkspaceShared
                      sharedWorkspace={sharedWorkspace}
                      onCopyDTable={onCopyDTable}
                      loadWorkspaceList={this.props.loadWorkspaceList}
                    />
                  }
                  {groupWorkspaceList.length > 0 && groupWorkspaceList.map((workspace, index) => {
                    return (
                      <DTableWorkspaceCommon
                        key={index}
                        workspace={workspace}
                        renameGroupName={this.renameGroupName}
                        onDeleteGroup={onDeleteGroup}
                        onDeleteTable={onDeleteTable}
                        onCopyDTable={onCopyDTable}
                        onAddGroupSharedTable={onAddGroupSharedTable}
                        onLeaveGroupSharedTable={onLeaveGroupSharedTable}
                        onLeaveGroupSharedView={onLeaveGroupSharedView}
                        onStarDTable={onStarDTable}
                        onUnstarDTable={onUnstarDTable}
                        onAddDTable={onAddDTable}
                        loadWorkspaceList={this.props.loadWorkspaceList}
                      />
                    );
                  })}
                  {isDesktop && canAddGroup &&
                    <div>
                      <button
                        className="btn btn-secondary dtable-add-btn my-4"
                        onClick={this.onCreateGroupToggle}
                        title={gettext('New group')}
                        aria-label={gettext('New group')}
                      >
                        {gettext('New group')}
                      </button>
                    </div>
                  }
                </Fragment>
              )}
            </div>
          </div>
        </div>
        {this.state.isShowCreateGroupDialog && (
          <CreateDtableGroupDialog
            onCreateGroup={this.onCreateGroup}
            toggleAddGroupModal={this.onCreateGroupToggle}
          />
        )}
      </Fragment>
    );
  }
}

MainPanelDTables.propTypes = propTypes;

export default MainPanelDTables;
