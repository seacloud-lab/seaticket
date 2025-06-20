import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { gettext } from '../../../../constants/config';
import { folderImageSrc } from '../../../../constants/image-source-constants';
import Rename from '../../../../components/rename';
import { isEnter } from '../../../../utils/hotkey';

export default class FolderTreeItem extends React.Component {

  static propTypes = {
    isOver: PropTypes.bool,
    isSelected: PropTypes.bool.isRequired,
    isOwnerOrAdmin: PropTypes.bool.isRequired,
    folder: PropTypes.object.isRequired,
    onFolderToggle: PropTypes.func.isRequired,
    deleteFolder: PropTypes.func.isRequired,
    setDropdownState: PropTypes.func.isRequired,
    getDropdownState: PropTypes.func.isRequired,
    connectDropTarget: PropTypes.func,
    onUpdateFolderName: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      dropdownOpen: false,
      folderName: props.folder.name,
      renaming: false,
    };
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onHotKey);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onHotKey);
  }

  onHotKey = (e) => {
    if (isEnter(e) && document.activeElement && document.activeElement.id === `folder-tree-item-${this.props.folder.id}`) {
      this.onOpenFolder();
    }
  };

  onMouseEnter = () => {
    if (this.state.renaming || this.props.getDropdownState()) return;
    this.setState({ active: true });
  };

  onMouseLeave = () => {
    if (this.state.renaming || this.props.getDropdownState()) return;
    this.setState({ active: false });
  };

  dropdownToggle = () => {
    if (this.state.dropdownOpen) {
      this.setState({ active: false });
    }
    if (this.props.setDropdownState) {
      this.props.setDropdownState(!this.state.dropdownOpen);
    }
    this.setState({ dropdownOpen: !this.state.dropdownOpen });
  };

  deleteFolder = () => {
    this.props.deleteFolder(this.props.folder.id);
  };

  onOpenFolder = (e) => {
    this.props.onFolderToggle(this.props.folder);
  };

  onDropDownClick = (e) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  openRenameFolder = () => {
    this.setState({ renaming: true });
  };

  onRenameCancel = () => {
    this.setState({ renaming: false });
  };

  onRenameConfirm = (folderName) => {
    this.setState({ folderName });
    this.props.onUpdateFolderName(this.props.folder.id, folderName);
  };

  render() {
    let { isOwnerOrAdmin, isSelected, folder, isOver, connectDropTarget } = this.props;
    let { active, folderName, renaming } = this.state;
    return connectDropTarget(
      <div
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
        onClick={this.onOpenFolder}
        className={`folder-item ${active || isOver ? 'tr-highlight' : ''} ${isSelected ? 'folder-item-selected' : ''}`}
        tabIndex={0}
        id={`folder-tree-item-${folder.id}`}
      >
        <div className="folder-name" id={`folder-${folder.id}`}>
          <img src={folderImageSrc} width="16px" alt="" className="mr-2" />
          {renaming ?
            <Rename
              className="d-flex"
              name={folderName}
              onRenameConfirm={this.onRenameConfirm}
              onRenameCancel={this.onRenameCancel}
            />
            :
            <span className="text-truncate w-100" aria-label={this.state.folderName}>{this.state.folderName}</span>
          }
          <span className="folder-dropdown-menu pr-2">
            {active && isOwnerOrAdmin &&
              <Dropdown
                isOpen={this.state.dropdownOpen}
                toggle={this.dropdownToggle}
                direction="down"
                className="folder-item-more-operation"
                onClick={this.onDropDownClick}
              >
                <DropdownToggle
                  tag="i"
                  role="button"
                  className="dtable-font dtable-icon-more-vertical cursor-pointer attr-action-icon"
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                  data-toggle="dropdown"
                  aria-expanded={this.state.dropdownOpen}
                />
                <DropdownMenu className="dtable-dropdown-menu dropdown-menu">
                  <DropdownItem onClick={this.openRenameFolder}>{gettext('Rename')}</DropdownItem>
                  <DropdownItem onClick={this.deleteFolder}>{gettext('Delete')}</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            }
          </span>
        </div>
      </div>
    );
  }
}
