import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import classnames from 'classnames';
import ModalPortal from '../../../components/modal-portal';
import RenameFolderDialog from '../dialog/rename-folder-dialog';
import { gettext } from '../../../utils/constants';
import { folderImageSrc } from '../../../constants/image-source-constants';
import { Utils } from '../../../utils/utils';

const propTypes = {
  style: PropTypes.object,
  className: PropTypes.string,
  folderItem: PropTypes.object.isRequired,
  folderType: PropTypes.string,
  appItemWidth: PropTypes.number,
  isOpenFolderDialog: PropTypes.bool,
  onDeleteFolder: PropTypes.func,
  onRenameFolder: PropTypes.func,
  onChangeCurrentFolder: PropTypes.func,
  onToggleCurrentFolderView: PropTypes.func,
  onToggleCurrentFolderDialog: PropTypes.func,
};

class AppFolder extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowMoreOperation: false,
      isShowDropdownMenu: false,
      isRenameFolder: false,
      isMoreOperationViewShow: false,
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

  toggleFolderDropdownMenu = (e) => {
    e.stopPropagation();
    if (this.isDesktop) {
      this.setState({ isShowDropdownMenu: !this.state.isShowDropdownMenu });
    } else {
      this.setState({ isMoreOperationViewShow: !this.state.isMoreOperationViewShow });
    }
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
          style={style}
          className={classnames('app-folder-item d-flex', className)}
          onMouseEnter={this.openMoreOperation}
          onMouseLeave={this.closeMoreOperation}
          onClick={this.openFolder}
        >
          <div className="app-folder-item-icon d-flex position-relative w-100">
            <img src={folderImageSrc} height="32px" alt='' />
            {(isShowMoreOperation || !this.isDesktop) && (
              <div className="app-folder-item-more">
                <i
                  className="dtable-font dtable-icon-more-level"
                  onClick={this.toggleFolderDropdownMenu}
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                />
              </div>
            )}
          </div>
          <div className="app-folder-item-name">
            <span>{folderItem.name}</span>
          </div>
        </div>
        {isShowDropdownMenu &&
          <Dropdown isOpen={isShowDropdownMenu} toggle={this.toggleFolderDropdownMenu}>
            <DropdownToggle tag="span" role="button" data-toggle="dropdown" />
            <DropdownMenu className="app-folder-dropdown">
              <DropdownItem className="rename-app-folder" onClick={this.openFolderEditor}>
                <span aria-hidden="true">
                  <i className="operation-icon item-icon dtable-font dtable-icon-rename" />
                </span>
                <span>{gettext('Rename')}</span>
              </DropdownItem>
              <DropdownItem className="delete-app-folder" onClick={this.deleteFolder}>
                <span aria-hidden="true">
                  <i className="operation-icon item-icon dtable-font dtable-icon-delete" />
                </span>
                <span>{gettext('Delete')}</span>
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        }
        {this.state.isMoreOperationViewShow &&
          <ModalPortal>
            <div className="mobile-operation-menu-bg-layer" onClick={this.toggleFolderDropdownMenu}></div>
            <div className="mobile-operation-menu" onClick={this.toggleFolderDropdownMenu}>
              <Dropdown
                isOpen={this.state.isMoreOperationViewShow}
                toggle={() => {}}
                style={{ width: '100%' }}
              >
                <DropdownItem className="mobile-dropdown-item" onClick={this.openFolderEditor}>
                  <span aria-hidden="true">
                    <i className="operation-icon item-icon dtable-font dtable-icon-rename" />
                  </span>
                  <span className="mobile-dropdown-span">{gettext('Rename')}</span>
                </DropdownItem>
                <DropdownItem className="mobile-dropdown-item" onClick={this.deleteFolder}>
                  <span aria-hidden="true">
                    <i className="operation-icon item-icon dtable-font dtable-icon-delete" />
                  </span>
                  <span className="mobile-dropdown-span">{gettext('Delete')}</span>
                </DropdownItem>
              </Dropdown>
            </div>
          </ModalPortal>
        }
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

AppFolder.propTypes = propTypes;

export default AppFolder;
