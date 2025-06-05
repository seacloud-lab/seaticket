import React from 'react';
import PropTypes from 'prop-types';
import { DropdownToggle, DropdownMenu, PopoverBody, Dropdown, DropdownItem } from 'reactstrap';
import DTablePopover from '../../../components/dtable-popover';
import { folderImageSrc } from '../../../constants/image-source-constants';
import Icon from '../../../components/icon';

import './css/app-item-popover.css';

const gettext = window.gettext;

class AppItemPopover extends React.Component {

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

  onOpenAppEditPage = () => {
    this.props.onOpenAppEditPage();
    this.props.onToggle();
  };

  onOpenAppBase = () => {
    this.props.onOpenAppBase();
    this.props.onToggle();
  };

  onLeaveApp = () => {
    this.props.onLeaveApp();
    this.props.onToggle();
  };

  moveToAppFolder = (folderId) => {
    const { appItem, onMoveAppToFolder } = this.props;
    appItem.current_folder = this.props.currentFolder ? this.props.currentFolder.id : '/';
    onMoveAppToFolder(appItem, folderId);
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
          key={`move-to-app-folder-${id}`}
          className="d-flex align-items-center"
          style={{ padding: '3px 12px' }}
          onClick={this.moveToAppFolder.bind(this, id)}
        >
          <img src={folderImageSrc} height="18px" alt='' />
          <span className="folder-name text-truncate ml-2" title={name}>
            {name}
          </span>
        </DropdownItem>
      );
    });
  };

  renderMoveApp = () => {
    const targetFolders = this.getTargetFolders();
    if (targetFolders.length === 0) {
      return null;
    }
    return (
      <div
        className="dropdown-item app-item-operation d-flex align-items-center"
        onMouseEnter={this.openFolderMenu}
        onMouseLeave={this.closeFolderMenu}
      >
        <Icon symbol="move-to" className="app-item-operation-icon" />
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
    const { target, isAdmin } = this.props;
    return (
      <DTablePopover
        target={target}
        placement="bottom-start"
        popoverClassName="app-item-popover"
        hideDTablePopover={this.props.onToggle}
        hideDTablePopoverWithEsc={this.props.onToggle}
        onEnter={this.onEnter}
        hideArrow={true}
      >
        <PopoverBody className="app-item-popover-content">
          {isAdmin ? (
            <>
              <button className="dropdown-item app-item-operation" onClick={this.onOpenAppEditPage}>
                <i className="app-item-operation-icon dtable-font dtable-icon-edit"></i>
                {gettext('Edit')}
              </button>
              <button className="dropdown-item app-item-operation" onClick={this.onOpenAppBase}>
                <i className="app-item-operation-icon dtable-font dtable-icon-dtable-logo"></i>
                {gettext('Open base')}
              </button>
              {this.renderMoveApp()}
            </>
          ) : (
            <>
              {this.renderMoveApp()}
              <button className="dropdown-item app-item-operation" onClick={this.onLeaveApp}>
                <Icon symbol="leave-app" className="app-item-operation-icon" />
                {gettext('Leave app')}
              </button>
            </>
          )}
        </PopoverBody>
      </DTablePopover>
    );
  }
}

AppItemPopover.propTypes = {
  target: PropTypes.string.isRequired,
  appItem: PropTypes.object.isRequired,
  onToggle: PropTypes.func.isRequired,
  onOpenAppBase: PropTypes.func.isRequired,
  onOpenAppEditPage: PropTypes.func.isRequired,
  onLeaveApp: PropTypes.func,
  isAdmin: PropTypes.bool,
  onMoveAppToFolder: PropTypes.func,
  folders: PropTypes.array,
  currentFolder: PropTypes.object,
};

export default AppItemPopover;
