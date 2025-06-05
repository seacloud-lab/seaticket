import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { toaster, DTableEmptyTip, DTableModalHeader } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../../../api/dtable-web-api';
import WorkflowGroup from '../../../../../workflow/model/workflow-group';
import { folderImageSrc } from '../../../../../constants/image-source-constants';
import { Utils } from '../../../../../utils/utils';
import { gettext } from '../../../../../utils/constants';
import { emptyWorkflowImageSrc, MANAGED_WORKFLOW_FOLDER } from '../../../../../workflow/constants/workflow-folder';

import WorkflowFolders from './sidebar/workflow-folders';
import WorkflowFolderPath from './workflow-folder-path';
import WorkflowItem from '../workflow-item';
import WorkflowFolder from '../workflow-folder';

import './index.css';

const propTypes = {
  currentFolder: PropTypes.object,
  workflows: PropTypes.array,
  folders: PropTypes.array,
  folderType: PropTypes.string,
  isManaged: PropTypes.bool,
  workflowItemWidth: PropTypes.number,
  refreshPendingtasksCount: PropTypes.func,
  onAddFolder: PropTypes.func,
  onRenameFolder: PropTypes.func,
  onDeleteFolder: PropTypes.func,
  onMoveWorkflowToFolder: PropTypes.func,
  onChangeCurrentFolder: PropTypes.func,
  onDeleteWorkflow: PropTypes.func,
  onUpdateWorkflowProperties: PropTypes.func,
  onToggleAddFolderDialog: PropTypes.func,
  onToggleCurrentFolderDialog: PropTypes.func,
};

class WorkflowFolderDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = { workflowsInFolder: [] };
  }

  componentDidMount() {
    this.initWorkflows();
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.workflows !== this.props.workflows ||
      prevProps.currentFolder !== this.props.currentFolder
    ) {
      this.initWorkflows();
    }
  }

  initWorkflows = () => {
    const { currentFolder } = this.props;
    if (currentFolder) {
      const { id } = currentFolder;
      dtableWebAPI.getWorkflowFolderContent(id).then((res) => {
        const { workflow_list } = res.data;
        const workflowsInFolder = Array.isArray(workflow_list) ? workflow_list.map(workflow => {
          workflow.folder_id = id;
          return new WorkflowGroup(workflow);
        }) : [];
        this.setState({ workflowsInFolder, folderList: [] });
      }).catch((err) => {
        const errMessage = Utils.getErrorMsg(err);
        toaster.danger(errMessage);
      });
    }
  };

  toggle = () => {
    this.props.onToggleCurrentFolderDialog(null, null);
  };

  getTargetFolders = () => {
    const { currentFolder, folders } = this.props;
    if (!currentFolder) {
      return folders;
    }
    return folders.filter(folder => folder.id !== currentFolder.id) || [];
  };

  isEmptyFolder = () => {
    const { currentFolder, workflows, folders } = this.props;
    const { workflowsInFolder } = this.state;
    if (!currentFolder) {
      return (workflows.length === 0 && folders.length === 0) ? true : false;
    }
    return workflowsInFolder.length === 0 ? true : false;
  };

  render() {
    const { currentFolder, workflows, folders, folderType, isManaged } = this.props;
    let { workflowsInFolder } = this.state;
    const title = folderType === MANAGED_WORKFLOW_FOLDER ? gettext('My managed workflows') : gettext('Workflows I can use');
    if (currentFolder === null) {
      workflowsInFolder = workflows;
    }
    const style = { width: this.props.workflowItemWidth };
    return (
      <Modal
        className="workflow-folder-dialog"
        isOpen={true}
        toggle={this.toggle}
        zIndex={100}
      >
        <DTableModalHeader toggle={this.toggle}>
          <div className="modal-folder-title">
            <img src={folderImageSrc} height="24px" alt='' />
            <span className="ml-2">
              {(currentFolder && currentFolder.name) || title}
            </span>
          </div>
        </DTableModalHeader>
        <ModalBody className="d-flex p-0">
          <WorkflowFolders
            currentFolder={currentFolder}
            folders={folders}
            title={title}
            onAddFolder={this.props.onAddFolder}
            onDeleteFolder={this.props.onDeleteFolder}
            onRenameFolder={this.props.onRenameFolder}
            onChangeCurrentFolder={this.props.onChangeCurrentFolder}
          />
          <div className="folder-dialog-right-section" ref={ref => this.rightSectionRef = ref}>
            <WorkflowFolderPath
              title={title}
              folder={this.props.currentFolder}
              onChangeCurrentFolder={this.props.onChangeCurrentFolder}
            />
            <div className="workflow-group-container" style={{ maxHeight: (window.innerHeight - 200) + 'px' }}>
              {this.isEmptyFolder() && (
                <div className="my-8">
                  <DTableEmptyTip src={emptyWorkflowImageSrc} text={gettext('No workflow have been added yet')} />
                </div>
              )}
              <div className="workflow-group-content d-flex">
                {!currentFolder && folders.map((folder) => {
                  const { id } = folder;
                  return (
                    <WorkflowFolder
                      key={`workflow-folder-${id}`}
                      style={style}
                      folderItem={folder}
                      isOpenFolderDialog={true}
                      onChangeCurrentFolder={this.props.onChangeCurrentFolder}
                      onDeleteFolder={this.props.onDeleteFolder}
                      onRenameFolder={this.props.onRenameFolder}
                      onToggleCurrentFolderDialog={this.props.onToggleCurrentFolderDialog}
                    />
                  );
                })}
                {workflowsInFolder.map((workflowItem) => {
                  const { id, group_id } = workflowItem;
                  return (
                    <WorkflowItem
                      key={`workflow-item-${group_id}-${id}`}
                      style={style}
                      workflowItem={workflowItem}
                      targetId={'workflow-item-in-folder'}
                      currentFolder={currentFolder}
                      folders={this.getTargetFolders()}
                      isManaged={isManaged}
                      onMoveWorkflowToFolder={this.props.onMoveWorkflowToFolder}
                      onUpdateWorkflowProperties={this.props.onUpdateWorkflowProperties}
                      onDeleteWorkflow={this.props.onDeleteWorkflow}
                      refreshPendingtasksCount={this.props.refreshPendingtasksCount}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

WorkflowFolderDialog.propTypes = propTypes;
WorkflowFolderDialog.defaultProps = { currentFolder: null };

export default WorkflowFolderDialog;
