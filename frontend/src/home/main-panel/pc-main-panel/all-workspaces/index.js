import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Loading } from '@/components';
import { isOrgContext } from '@constants';
import Workspace from '../../../workspace';
import CreateGroupDialog from '../../../dialog/create-group-dialog';
import { Utils } from '@/utils/utils';
import SessionStorage from '@/utils/session-utils';
import OrgTitle from './org-title';
import OrgAiLimitPrompt from './org-ai-limit-prompt';

class AllWorkspaces extends React.Component {

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
    let { isWorkspaceListLoading, workspaceList, errorMsg, onCopyProject,
      onDeleteProject, onDeleteGroup, onAddProject
    } = this.props;
    if (isWorkspaceListLoading) {
      return (<div className="mt-6"><Loading /></div>);
    }

    const personalWorkspace = workspaceList.find(workspace => workspace.type === 'personal');

    const groupWorkspaceList = workspaceList.filter(workspace => workspace.type === 'group');

    const isDesktop = Utils.isDesktop();

    return (
      <Fragment>
        <div className="main-panel-center project-center">
          <div className="cur-view-container d-flex flex-1 flex-column">
            {isOrgContext &&
              <OrgTitle
                isDesktop={isDesktop}
                onCreateGroupToggle={this.onCreateGroupToggle}
              />
            }
            <OrgAiLimitPrompt isDesktop={isDesktop} />
            <div
              className={`${isDesktop ? '' : 'p-0'} cur-view-content`}
              onScroll={Utils.debounce(this.onScroll)}
              ref={ref => this.viewContent = ref}
            >
              {errorMsg && <p className="error text-center">{errorMsg}</p>}
              {!errorMsg && (
                <Fragment>
                  {personalWorkspace &&
                    <Workspace
                      workspace={personalWorkspace}
                      onCopyProject={onCopyProject}
                      onDeleteProject={onDeleteProject}
                      onAddProject={onAddProject}
                      loadWorkspaceList={this.props.loadWorkspaceList}
                      page="all-workspaces"
                    />
                  }
                  {groupWorkspaceList.length > 0 && groupWorkspaceList.map((workspace, index) => {
                    return (
                      <Workspace
                        key={index}
                        workspace={workspace}
                        renameGroupName={this.renameGroupName}
                        onDeleteGroup={onDeleteGroup}
                        onDeleteProject={onDeleteProject}
                        onCopyProject={onCopyProject}
                        onAddProject={onAddProject}
                        loadWorkspaceList={this.props.loadWorkspaceList}
                        page="all-workspaces"
                      />
                    );
                  })}
                </Fragment>
              )}
            </div>
          </div>
        </div>
        {this.state.isShowCreateGroupDialog && <CreateGroupDialog onSubmit={this.onCreateGroup} onToggle={this.onCreateGroupToggle}/>}
      </Fragment>
    );
  }
}

AllWorkspaces.propTypes = {
  isWorkspaceListLoading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  workspaceList: PropTypes.array.isRequired,
  loadWorkspaceList: PropTypes.func.isRequired,
  onDeleteGroup: PropTypes.func.isRequired,
  onCopyProject: PropTypes.func.isRequired,
  onDeleteProject: PropTypes.func.isRequired,
  onAddProject: PropTypes.func.isRequired,
  updateSidePanelGroups: PropTypes.func.isRequired,
};

export default AllWorkspaces;
