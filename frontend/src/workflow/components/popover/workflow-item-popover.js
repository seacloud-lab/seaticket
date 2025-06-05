import React from 'react';
import PropTypes from 'prop-types';
import { DropdownToggle, DropdownMenu, PopoverBody, Dropdown, DropdownItem } from 'reactstrap';
import DTablePopover from '../../../components/dtable-popover';
import { gettext } from '../../../utils/constants';
import { folderImageSrc } from '../../../constants/image-source-constants';
import Icon from '../../../components/icon';

import '../../css/popover/workflow-item-popover.css';

class WorkflowItemPopover extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowTargetFolders: false,
    };
  }

  onEnter = (e) => {
    e.preventDefault();
    this.props.onToggle();
  };

  onModifyNameAndIcon = () => {
    this.props.onModifyNameAndIcon();
    this.props.onToggle();
  };

  onDeleteWorkflow = () => {
    this.props.onDeleteWorkflow();
    this.props.onToggle();
  };

  onShareWorkflow = () => {
    this.props.onShareWorkflow();
    this.props.onToggle();
  };

  onOpenWorkflowBase = () => {
    this.props.onOpenWorkflowBase();
    this.props.onToggle();
  };

  onEditWorkflow = () => {
    window.open(this.props.workflow.workflow_edit_link);
    this.props.onToggle();
  };

  moveToWorkflowFolder = (folderId) => {
    const { workflow, onMoveWorkflowToFolder } = this.props;
    onMoveWorkflowToFolder(workflow, folderId);
  };

  openFolderMenu = () => {
    this.setState({ isShowTargetFolders: true });
  };

  closeFolderMenu = () => {
    this.setState({ isShowTargetFolders: false });
  };

  toggleFoldersMenu = () => {
    this.setState({ isShowTargetFolders: !this.state.isShowTargetFolders });
  };

  getTargetFolders = () => {
    const { folders, currentFolder } = this.props;
    const isShowRootFolder = !!currentFolder;
    const targetFolders = [...folders];
    if (isShowRootFolder) {
      const rootFolder = { name: '/', id: '/' };
      targetFolders.unshift(rootFolder);
    }
    return targetFolders;
  };

  renderTargetFolders = () => {
    const targetFolders = this.getTargetFolders();
    return targetFolders.map(folder => {
      const { id, name } = folder;
      return (
        <DropdownItem
          key={`move-to-workflow-folder-${id}`}
          className="d-flex align-items-center"
          style={{ padding: '3px 12px' }}
          onClick={this.moveToWorkflowFolder.bind(this, id)}
        >
          <img src={folderImageSrc} height="18px" alt='' />
          <span className="folder-name text-truncate ml-2" title={name}>
            {name}
          </span>
        </DropdownItem>
      );
    });
  };

  renderMoveWorkflow = () => {
    const targetFolders = this.getTargetFolders();
    if (targetFolders.length === 0) {
      return null;
    }
    return (
      <div
        className="dropdown-item workflow-item-operation d-flex align-items-center"
        onMouseEnter={this.openFolderMenu}
        onMouseLeave={this.closeFolderMenu}
      >
        <Icon symbol="move-to" />
        <span className="item-text flex-fill">{gettext('Move to')}</span>
        <span className="d-inline-flex align-items-center w-2">
          <i className="item-icon dtable-font dtable-icon-down3 rotate-270" />
        </span>
        <Dropdown isOpen={this.state.isShowTargetFolders} toggle={this.toggleFoldersMenu}>
          <DropdownToggle tag="span" role="button" data-toggle="dropdown" className="move-to-folders-toggle" />
          <DropdownMenu
            className="folders-dropdown-menu"
            positionFixed={true}
            modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]}
          >
            {this.renderTargetFolders()}
          </DropdownMenu>
        </Dropdown>
      </div>
    );
  };

  render() {
    const { target, isManaged } = this.props;
    return (
      <DTablePopover
        target={target}
        placement="right-start"
        popoverClassName="workflow-item-popover"
        hideDTablePopover={this.props.onToggle}
        hideDTablePopoverWithEsc={this.props.onToggle}
        onEnter={this.onEnter}
        hideArrow={true}
      >
        <PopoverBody className="workflow-item-popover-content">
          {isManaged ? (
            <>
              <button className="dropdown-item workflow-item-operation" onClick={this.onModifyNameAndIcon}>
                <i className="workflow-item-operation-icon dtable-font dtable-icon-rename"></i>
                {gettext('Modify name and icon')}
              </button>
              <button className="dropdown-item workflow-item-operation" onClick={this.onShareWorkflow}>
                <Icon symbol="access-permissions" className="workflow-item-operation-icon access-permissions" />
                {gettext('Manage permissions')}
              </button>
              <button className="dropdown-item workflow-item-operation" onClick={this.onOpenWorkflowBase}>
                <i className="workflow-item-operation-icon dtable-font dtable-icon-dtable-logo"></i>
                {gettext('Open base')}
              </button>
              <button className="dropdown-item workflow-item-operation" onClick={this.onEditWorkflow}>
                <i className="workflow-item-operation-icon dtable-font dtable-icon-edit"></i>
                {gettext('Edit workflow')}
              </button>
              {this.renderMoveWorkflow()}
              <button className="dropdown-item workflow-item-operation" onClick={this.onDeleteWorkflow}>
                <i className="workflow-item-operation-icon dtable-font dtable-icon-delete"></i>
                {gettext('Delete workflow')}
              </button>
            </>
          ) : (
            this.renderMoveWorkflow()
          )}
        </PopoverBody>
      </DTablePopover>
    );
  }
}

WorkflowItemPopover.propTypes = {
  target: PropTypes.string.isRequired,
  onToggle: PropTypes.func.isRequired,
  onOpenWorkflowBase: PropTypes.func.isRequired,
  onModifyNameAndIcon: PropTypes.func.isRequired,
  onShareWorkflow: PropTypes.func.isRequired,
  onDeleteWorkflow: PropTypes.func.isRequired,
  workflow: PropTypes.object.isRequired,
  onMoveWorkflowToFolder: PropTypes.func,
  folders: PropTypes.array,
  currentFolder: PropTypes.object,
  isManaged: PropTypes.bool,
};

export default WorkflowItemPopover;
