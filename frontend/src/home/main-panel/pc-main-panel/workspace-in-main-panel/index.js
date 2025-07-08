import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { EmptyTip, Loading } from '../../../../components';
import { isOrgContext, orgName, mediaUrl } from '../../../../constants';
import Workspace from '../../../workspace';
import { Utils } from '../../../../utils/utils';

const gettext = window.gettext;

class WorkspaceInMainPanel extends React.Component {

  componentDidMount() {
    this.props.loadWorkspaceList();
  }

  renameGroupName = () => {
    this.props.loadWorkspaceList();
    this.props.updateSidePanelGroups(true);
  };

  renderWorkspace = () => {
    const { dtableID, workspaceList, onCopyProject, onDeleteProject,
      onDeleteGroup, onAddGroupSharedProject, onLeaveGroupSharedProject,
      onAddProject } = this.props;

    let workspace = workspaceList.find(workspace => {
      return workspace.id === Number(dtableID);
    });
    if (!workspace) {
      workspace = workspaceList.find(workspace => workspace.type === 'personal');
    }

    return (
      <Workspace
        workspace={workspace}
        renameGroupName={this.renameGroupName}
        onDeleteGroup={onDeleteGroup}
        onDeleteProject={onDeleteProject}
        onCopyProject={onCopyProject}
        onAddGroupSharedProject={onAddGroupSharedProject}
        onLeaveGroupSharedProject={onLeaveGroupSharedProject}
        onAddProject={onAddProject}
        loadWorkspaceList={this.props.loadWorkspaceList}
        noBaseTip={
          <EmptyTip text={gettext('No projects.')} src={`${mediaUrl}img/no-items-tip.png`} />
        }
      />
    );
  };

  render() {
    let { isWorkspaceListLoading, errorMsg } = this.props;

    if (isWorkspaceListLoading) {
      return <Loading />;
    }
    const isDesktop = Utils.isDesktop();

    return (
      <Fragment>
        <div className="main-panel-center dtable-center">
          <div className="cur-view-container d-flex flex-1 flex-column">
            <div className={`${isDesktop ? '' : 'p-0'} cur-view-content`}>
              {isOrgContext &&
                <div className={`py-4 dtable-org-title ${isDesktop ? '' : 'dtable-mobile-org-title'}`}>
                  <i aria-hidden="true" className="dtable-org-icon dtable-font dtable-icon-organization-name"></i>
                  <h1 title={orgName} aria-label={orgName} className="dtable-org-name">{orgName}</h1>
                </div>
              }
              {errorMsg && <p className="error text-center">{errorMsg}</p>}
              {!errorMsg && this.renderWorkspace()}
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

WorkspaceInMainPanel.propTypes = {
  workspaceList: PropTypes.array.isRequired,
  isWorkspaceListLoading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  loadWorkspaceList: PropTypes.func.isRequired,
  onDeleteGroup: PropTypes.func.isRequired,
  onCopyProject: PropTypes.func.isRequired,
  onDeleteProject: PropTypes.func.isRequired,
  onLeaveGroupSharedProject: PropTypes.func.isRequired,
  onAddGroupSharedProject: PropTypes.func.isRequired,
  onAddProject: PropTypes.func.isRequired,
  updateSidePanelGroups: PropTypes.func.isRequired,
  dtableID: PropTypes.string,
};

export default WorkspaceInMainPanel;
