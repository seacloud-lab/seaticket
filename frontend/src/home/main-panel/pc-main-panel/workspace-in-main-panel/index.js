import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { DTableEmptyTip } from 'dtable-ui-component';
import Loading from '../../../../components/loading';
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
    const { dtableID, workspaceList, onCopyDTable, onDeleteTable,
      onDeleteGroup, onAddGroupSharedTable, onLeaveGroupSharedTable,
      onAddDTable } = this.props;

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
        onDeleteTable={onDeleteTable}
        onCopyDTable={onCopyDTable}
        onAddGroupSharedTable={onAddGroupSharedTable}
        onLeaveGroupSharedTable={onLeaveGroupSharedTable}
        onAddDTable={onAddDTable}
        loadWorkspaceList={this.props.loadWorkspaceList}
        noBaseTip={
          <DTableEmptyTip text={gettext('No bases or folders.')} src={`${mediaUrl}img/no-items-tip.png`} />
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
  onCopyDTable: PropTypes.func.isRequired,
  onDeleteTable: PropTypes.func.isRequired,
  onLeaveGroupSharedTable: PropTypes.func.isRequired,
  onAddGroupSharedTable: PropTypes.func.isRequired,
  onAddDTable: PropTypes.func.isRequired,
  updateSidePanelGroups: PropTypes.func.isRequired,
  dtableID: PropTypes.string,
};

export default WorkspaceInMainPanel;
