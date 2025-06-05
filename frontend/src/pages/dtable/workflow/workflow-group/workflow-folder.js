import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import classnames from 'classnames';
import RenameFolderDialog from '../../dialog/rename-folder-dialog';
import { gettext } from '../../../../utils/constants';
import { folderImageSrc } from '../../../../constants/image-source-constants';
import { Utils } from '../../../../utils/utils';

const propTypes = {
  style: PropTypes.object,
  className: PropTypes.string,
  folderItem: PropTypes.object.isRequired,
  folderType: PropTypes.string,
  workflowItemWidth: PropTypes.number,
  isOpenFolderDialog: PropTypes.bool,
  onDeleteFolder: PropTypes.func,
  onRenameFolder: PropTypes.func,
  onChangeCurrentFolder: PropTypes.func,
  onToggleCurrentFolderView: PropTypes.func,
  onToggleCurrentFolderDialog: PropTypes.func,
};

class WorkflowFolder extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowMoreOperation: false,
      isShowDropdownMenu: false,
      isRenameFolder: false,
    };
    this.isDesktop = Utils.isDesktop();
  }

  openMoreOperation = (e) => {
    e.nativeEvent.stopImmediatePropagation();
    this.setState({ isShowMoreOperation: true });
  };

  closeMoreOperation = (e) => {
    e.nativeEvent.stopImmediatePropagation();
    this.setState({ isShowMoreOperation: false });
  };

  openFolderDropdownMenu = (e) => {
    e.stopPropagation();
    this.setState({ isShowDropdownMenu: !this.state.isShowDropdownMenu });
  };

  openFolderEditor = () => {
    this.setState({ isRenameFolder: true });
  };

  closeFolderEditor = () => {
    this.setState({ isRenameFolder: false });
  };

  deleteFolder = () => {
    const { folderItem } = this.props;
    this.props.onDeleteFolder(folderItem);
  };

  openFolder = () => {
    const { isOpenFolderDialog, folderType, folderItem, onToggleCurrentFolderDialog,
      onToggleCurrentFolderView, onChangeCurrentFolder } = this.props;
    if (isOpenFolderDialog) {
      onChangeCurrentFolder(folderItem);
      return;
    }
    this.isDesktop ? onToggleCurrentFolderDialog(folderType, folderItem) : onToggleCurrentFolderView(folderItem);
  };

  render() {
    const { style, className, folderItem } = this.props;
    const { isShowMoreOperation, isShowDropdownMenu, isRenameFolder } = this.state;

    return (
      <>
        <div
          style={{ ...style, background: 'rgb(255, 250, 235)' }}
          className={classnames('workflow-folder-item d-flex', className)}
          onMouseEnter={this.openMoreOperation}
          onMouseLeave={this.closeMoreOperation}
          onClick={this.openFolder}
        >
          <div className="workflow-folder-item-icon d-flex position-relative w-100">
            <img src={folderImageSrc} height="32px" alt='' />
            {isShowMoreOperation && (
              <div className="workflow-folder-item-more">
                <i
                  className="dtable-font dtable-icon-more-level"
                  onClick={this.openFolderDropdownMenu}
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                />
              </div>
            )}
          </div>
          <div className="workflow-folder-item-name">
            <span>{folderItem.name}</span>
          </div>
        </div>
        <Dropdown isOpen={isShowDropdownMenu} toggle={this.openFolderDropdownMenu}>
          <DropdownToggle tag="span" role="button" data-toggle="dropdown" />
          <DropdownMenu className="workflow-folder-dropdown">
            <DropdownItem className="rename-workflow-folder" onClick={this.openFolderEditor}>
              <span aria-hidden="true">
                <i className="operation-icon item-icon dtable-font dtable-icon-rename" />
              </span>
              <span>{gettext('Rename')}</span>
            </DropdownItem>
            <DropdownItem className="delete-workflow-folder" onClick={this.deleteFolder}>
              <span aria-hidden="true">
                <i className="operation-icon item-icon dtable-font dtable-icon-delete" />
              </span>
              <span>{gettext('Delete')}</span>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
        {isRenameFolder && (
          <RenameFolderDialog
            folder={folderItem}
            closeDialog={this.closeFolderEditor}
            onRenameFolder={this.props.onRenameFolder}
          />
        )}
      </>
    );
  }
}

WorkflowFolder.propTypes = propTypes;

export default WorkflowFolder;
