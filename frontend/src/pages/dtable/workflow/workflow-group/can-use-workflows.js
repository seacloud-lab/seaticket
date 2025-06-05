import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { DTableEmptyTip } from 'dtable-ui-component';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import WorkflowItem from './workflow-item';
import WorkflowFolder from './workflow-folder';
import { gettext } from '../../../../utils/constants';
import { CAN_USED_WORKFLOW_FOLDER, emptyCanUseWorkflowImageSrc } from '../../../../workflow/constants/workflow-folder';

function CanUseWorkflows(props) {
  const [isShowDropdownMenu, setIsShowDropdownMenu] = useState(false);

  const {
    workflows, onDeleteFolder, onRenameFolder,
    onToggleCurrentFolderDialog, onToggleCurrentFolderView, onMoveWorkflowToFolder, onToggleAddFolderDialog,
    getWorkflowItemClassAndStyle, canUsedWorkflowFolders, refreshPendingtasksCount,
  } = props;

  function toggleDropdownMenu() {
    setIsShowDropdownMenu(!isShowDropdownMenu);
  }

  function toggleAddFolderDialog() {
    onToggleAddFolderDialog(CAN_USED_WORKFLOW_FOLDER);
  }

  const workflowsCount = workflows.length;
  const foldersCount = canUsedWorkflowFolders.length;
  const total = workflowsCount + foldersCount;

  return (
    <div className="workflow-group-container">
      <div className="workflow-group-name">
        <span className="text-truncate">{gettext('Workflows I can use')}</span>
        <Dropdown isOpen={isShowDropdownMenu} toggle={toggleDropdownMenu} className="workflows-dropdown">
          <DropdownToggle
            tag="i"
            role="button"
            className="toggle-icon dtable-font dtable-icon-down3"
            data-toggle="dropdown"
            aria-expanded={isShowDropdownMenu}
            title={gettext('More operations')}
            aria-label={gettext('More operations')}
            aria-haspopup={true}
          />
          <DropdownMenu>
            <DropdownItem className="create-workflow-folder-item" onClick={toggleAddFolderDialog}>
              <span aria-hidden="true">
                <i className="item-icon dtable-font dtable-icon-folders" />
              </span>
              <span>{gettext('Create a folder')}</span>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
      {total === 0 ?
        <div className="my-8">
          <DTableEmptyTip src={emptyCanUseWorkflowImageSrc}>
            <p className="empty-tip-text">{gettext('No workflow has been shared with you yet')}</p>
            <p className="empty-tip-text">{gettext('Workflows shared to your groups will appear here')}</p>
          </DTableEmptyTip>
        </div>
        :
        (
          <div className="workflow-group-content d-flex">
            {canUsedWorkflowFolders.map((folder, index) => {
              const { className, style } = getWorkflowItemClassAndStyle(index, total);
              const { id } = folder;
              return (
                <WorkflowFolder
                  key={`workflow-item-${id}`}
                  style={style}
                  className={className}
                  folderItem={folder}
                  folderType={CAN_USED_WORKFLOW_FOLDER}
                  onDeleteFolder={onDeleteFolder}
                  onRenameFolder={onRenameFolder}
                  onToggleCurrentFolderView={onToggleCurrentFolderView}
                  onToggleCurrentFolderDialog={onToggleCurrentFolderDialog}
                />
              );
            })
            }
            {workflows.map((workflowItem, index) => {
              const { id, group_id } = workflowItem;
              const { className, style } = getWorkflowItemClassAndStyle(index + foldersCount, total);
              return (
                <WorkflowItem
                  key={`workflow-item-${group_id}-${id}`}
                  style={style}
                  className={className}
                  workflowItem={workflowItem}
                  folders={canUsedWorkflowFolders}
                  isManaged={false}
                  onMoveWorkflowToFolder={onMoveWorkflowToFolder}
                  refreshPendingtasksCount={refreshPendingtasksCount}
                />
              );
            })}
          </div>
        )
      }
    </div>
  );
}

CanUseWorkflows.propTypes = {
  workflows: PropTypes.array,
  canUsedWorkflowFolders: PropTypes.array,
  workflowItemWidth: PropTypes.number,
  getWorkflowItemClassAndStyle: PropTypes.func,
  refreshPendingtasksCount: PropTypes.func,
  onRenameFolder: PropTypes.func,
  onDeleteFolder: PropTypes.func,
  onToggleAddFolderDialog: PropTypes.func,
  onToggleCurrentFolderView: PropTypes.func,
  onToggleCurrentFolderDialog: PropTypes.func,
  onMoveWorkflowToFolder: PropTypes.func,
};

export default CanUseWorkflows;
