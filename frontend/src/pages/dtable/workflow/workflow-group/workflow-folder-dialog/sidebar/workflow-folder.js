import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { folderImageSrc } from '../../../../../../constants/image-source-constants';
import { gettext } from '../../../../../../utils/constants';
import Rename from '../../../../../../components/rename';

const propTypes = {
  folder: PropTypes.object,
  folders: PropTypes.array,
  isActive: PropTypes.bool,
  onDeleteFolder: PropTypes.func,
  onRenameFolder: PropTypes.func,
  onChangeCurrentFolder: PropTypes.func,
};

class WorkflowFolder extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowMoreOperationIcon: false,
      isShowDropdownMenu: false,
      isRenameFolder: false,
    };
  }

  deleteFolder = () => {
    const { folder, onDeleteFolder } = this.props;
    onDeleteFolder(folder);
  };

  openMoreOperation = () => {
    this.setState({ isShowMoreOperationIcon: true });
  };

  closeMoreOperation = () => {
    this.setState({ isShowMoreOperationIcon: false, isShowDropdownMenu: false });
  };

  openFolderNameEditor = () => {
    this.setState({ isRenameFolder: true });
  };

  closeFolderNameEditor = () => {
    this.setState({ isRenameFolder: false });
  };

  handleDropdownClick = (e) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  toggleDropdownMenu = () => {
    this.setState({ isShowDropdownMenu: !this.state.isShowDropdownMenu });
  };

  render() {
    const { folder, isActive } = this.props;
    const { isShowMoreOperationIcon, isRenameFolder } = this.state;
    return (
      <div
        className={`workflow-folder-tree-item ${isActive ? 'active-item' : ''}`}
        onClick={this.props.onChangeCurrentFolder.bind(this, folder)}
        onMouseEnter={this.openMoreOperation}
        onMouseLeave={this.closeMoreOperation}
      >
        <img className="mr-2" src={folderImageSrc} height="16px" alt='' />
        <div className="workflow-folder-item-name text-truncate w-100">
          {isRenameFolder ? (
            <Rename
              name={folder.name}
              onRenameConfirm={(name) => this.props.onRenameFolder(folder, name)}
              onRenameCancel={this.closeFolderNameEditor}
            />
          ) : (
            <span>{folder.name}</span>
          )}
        </div>
        <span className="folder-dropdown-menu pr-2">
          {isShowMoreOperationIcon && (
            <Dropdown
              isOpen={this.state.isShowDropdownMenu}
              toggle={this.toggleDropdownMenu}
              direction="down"
              className="folder-item-more-operation"
              onClick={this.handleDropdownClick}
            >
              <DropdownToggle
                tag="i"
                role="button"
                className="dtable-font dtable-icon-more-vertical cursor-pointer attr-action-icon"
                title={gettext('More operations')}
                aria-label={gettext('More operations')}
                data-toggle="dropdown"
                aria-expanded={this.state.isShowDropdownMenu}
              />
              <DropdownMenu className="dtable-dropdown-menu dropdown-menu">
                <DropdownItem onClick={this.openFolderNameEditor}>{gettext('Rename')}</DropdownItem>
                <DropdownItem onClick={this.deleteFolder}>{gettext('Delete')}</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          )}
        </span>
      </div>
    );
  }
}

WorkflowFolder.propTypes = propTypes;

export default WorkflowFolder;
