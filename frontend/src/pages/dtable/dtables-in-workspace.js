import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { isNumber } from 'dtable-utils';
import { DTableEmptyTip } from 'dtable-ui-component';
import Loading from '../../components/loading';
import { isOrgContext, orgName, mediaUrl } from '../../utils/constants';
import DTableWorkspaceCommon from './dtable-workspace-common';
import DTableWorkspaceShared from './dtable-workspace-shared';
import { Utils } from '../../utils/utils';
import DTableWorkspaceStarred from './dtable-workspace-starred';

const gettext = window.gettext;

const propTypes = {
  workspaceList: PropTypes.array.isRequired,
  isWorkspaceListLoading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
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
  dtableID: PropTypes.string,
};

class DTablesInWorkspace extends React.Component {

  componentDidMount() {
    this.props.loadWorkspaceList();
  }

  renameGroupName = () => {
    this.props.loadWorkspaceList();
    this.props.updateSidePanelGroups(true);
  };

  renderWorkspace = () => {
    const { dtableID, workspaceList, onCopyDTable, onDeleteTable,
      onDeleteGroup, onAddGroupSharedTable, onLeaveGroupSharedTable, onLeaveGroupSharedView,
      onStarDTable, onUnstarDTable, onAddDTable } = this.props;

    if (!isNumber(dtableID)) {
      if (dtableID === 'starred') {
        const starredWorkspace = workspaceList.find(workspace => {
          return workspace.type === 'starred';
        });
        const personalWorkspace = workspaceList.find(workspace => {
          return workspace.type === 'personal';
        });
        const groupWorkspaceList = workspaceList.filter(workspace => {
          return workspace.type === 'group';
        });
        return (
          <DTableWorkspaceStarred
            starredWorkspace={starredWorkspace}
            onUnstarDTable={onUnstarDTable}
            personalWorkspace={personalWorkspace}
            groupWorkspaceList={groupWorkspaceList}
            noBaseTip={
              <DTableEmptyTip text={gettext('You don\'t have starred base yet.')} src={`${mediaUrl}img/no-items-tip.png`} />
            }
          />
        );
      }

      if (dtableID === 'shared') {
        const sharedWorkspace = workspaceList.find(workspace => {
          return workspace.type === 'shared';
        });
        return (
          <DTableWorkspaceShared
            sharedWorkspace={sharedWorkspace}
            onCopyDTable={onCopyDTable}
            noBaseTip={
              <DTableEmptyTip text={gettext('No bases have been shared with you yet.')} src={`${mediaUrl}img/no-items-tip.png`} />
            }
            loadWorkspaceList={this.props.loadWorkspaceList}
          />
        );
      }
    }

    let workspace = workspaceList.find(workspace => {
      return workspace.id === Number(dtableID);
    });
    if (!workspace) {
      workspace = workspaceList.find(workspace => workspace.type === 'personal');
    }

    return (
      <DTableWorkspaceCommon
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

DTablesInWorkspace.propTypes = propTypes;

export default DTablesInWorkspace;
