import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import Rename from '../../../../../components/rename';
import { gettext } from '../../../../../utils/constants';
import { folderImageSrc } from '../../../../../constants/image-source-constants';
import { Utils } from '../../../../../utils/utils';

const propTypes = {
  isActive: PropTypes.bool,
  folder: PropTypes.object.isRequired,
  onDeleteFolder: PropTypes.func,
  onRenameFolder: PropTypes.func,
  onChangeCurrentFolder: PropTypes.func,
};

class AppFolder extends React.Component {

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
    this.setState({ isShowMoreOperation: true });
  };

  closeMoreOperation = (e) => {
    this.setState({ isShowMoreOperation: false });
  };

  toggleDropdownMenu = (e) => {
    this.setState({ isShowDropdownMenu: !this.state.isShowDropdownMenu });
  };

  openFolderNameEditor = () => {
    this.setState({ isRenameFolder: true });
  };

  handleDropdownClick = (e) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  closeFolderNameEditor = () => {
    this.setState({ isRenameFolder: false });
  };

  deleteFolder = () => {
    const { folder } = this.props;
    this.props.onDeleteFolder(folder);
  };

  render() {
    const { folder, isActive } = this.props;
    const { isShowMoreOperation, isShowDropdownMenu, isRenameFolder } = this.state;

    return (
      <>
        <div
          className={`app-folder-tree-item ${isActive ? 'active-item' : ''}`}
          onMouseEnter={this.openMoreOperation}
          onMouseLeave={this.closeMoreOperation}
          onClick={this.props.onChangeCurrentFolder.bind(this, folder)}
        >
          <img className="mr-2" src={folderImageSrc} height="16px" alt='' />
          <div className="app-folder-item-name text-truncate w-100">
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
            {isShowMoreOperation && (
              <Dropdown
                isOpen={isShowDropdownMenu}
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
                  aria-expanded={isShowDropdownMenu}
                />
                <DropdownMenu className="dtable-dropdown-menu dropdown-menu">
                  <DropdownItem onClick={this.openFolderNameEditor}>{gettext('Rename')}</DropdownItem>
                  <DropdownItem onClick={this.deleteFolder}>{gettext('Delete')}</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            )}
          </span>
        </div>
      </>
    );
  }
}

AppFolder.propTypes = propTypes;

export default AppFolder;
