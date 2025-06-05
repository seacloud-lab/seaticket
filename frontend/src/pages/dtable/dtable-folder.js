import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { gettext } from '../../utils/constants';
import { isEnter } from '../../utils/hotkey';
import Rename from '../../components/rename';
import { Utils } from '../../utils/utils';
import FolderSettingsView from './mobile/folder-settings-view';
import ModalPortal from '../../components/modal-portal';
import { folderImageSrc } from '../../constants/image-source-constants';

const dtableFolderPropTypes = {
  isOwnerOrAdmin: PropTypes.bool,
  folder: PropTypes.object.isRequired,
  onFolderToggle: PropTypes.func,
  deleteFolder: PropTypes.func,
  onUpdateFolderName: PropTypes.func,
  connectDropTarget: PropTypes.func,
  moveFolderItem: PropTypes.func,
  isOver: PropTypes.bool,
  setDropdownState: PropTypes.func,
  getDropdownState: PropTypes.func,
};

class DTableFolder extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      active: false,
      dropdownOpen: false,
      isShowFolderIconSettings: false,
      renaming: false,
      folderName: props.folder.name,
    };
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onHotKey);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onHotKey);
  }

  onHotKey = (e) => {
    if (isEnter(e) && document.activeElement && document.activeElement.id === `dtable-folder-name-${this.props.folder.id}`) {
      this.onOpenFolder(e, this.props.folder);
    }
  };

  onMouseEnter = () => {
    if (this.props.getDropdownState && this.props.getDropdownState()) return;
    this.setState({ active: true });
  };

  onMouseLeave = () => {
    if (this.props.getDropdownState && this.props.getDropdownState()) return;
    if (this.state.isShowFolderIconSettings) return;
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
    this.props.onFolderToggle(e, this.props.folder);
  };

  onRename = (e) => {
    if (e) e.stopPropagation();
    this.setState({ renaming: !this.state.renaming });
  };

  onFolderIconToggle = (e) => {
    if (e) {
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
    }
    this.setState({ isShowFolderIconSettings: !this.state.isShowFolderIconSettings });
  };

  onNameChange = (folderName) => {
    this.setState({ folderName });
    this.props.onUpdateFolderName(this.props.folder.id, folderName);
  };

  onDropDownClick = (e) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  renderFolderIcon = () => {
    return <div><img src={folderImageSrc} width="36px" alt="" /></div>;
  };

  renderFolderName = () => {
    let { folder } = this.props;
    const { renaming, folderName } = this.state;
    return (
      <div className="table-name" id={`dtable-folder-${folder.id}`}>
        {renaming ?
          <Rename
            name={folderName}
            onRenameConfirm={this.onNameChange}
            onRenameCancel={this.onRename}
          />
          :
          <span title={folderName} aria-label={folderName} tabIndex={0} id={`dtable-folder-name-${folder.id}`}>{folderName}</span>
        }
      </div>
    );
  };

  render() {
    let { isOwnerOrAdmin, folder, connectDropTarget, isOver } = this.props;
    let { name } = folder;
    const isDesktop = Utils.isDesktop();
    if (!isDesktop) {
      return (
        <>
          <div className="table-mobile-item" onClick={this.onOpenFolder}>
            {this.renderFolderIcon()}
            <div className="table-mobile-name" id={`dtable-folder-${folder.id}`}>{name}</div>
            <div className="table-mobile-dropdown-menu">
              {isOwnerOrAdmin && (
                <Dropdown
                  isOpen={this.state.dropdownOpen}
                  toggle={this.dropdownToggle}
                  direction="down"
                  className="table-item-more-operation"
                  onClick={this.onDropDownClick}
                >
                  <DropdownToggle
                    tag='i'
                    role="button"
                    className='dtable-font dtable-icon-more-vertical table-dropdown-menu-icon'
                    title={gettext('More operations')}
                    aria-label={gettext('More operations')}
                    data-toggle="dropdown"
                    aria-expanded={this.state.dropdownOpen}
                    aria-haspopup={true}
                  >
                  </DropdownToggle>
                  <div className={this.state.dropdownOpen ? '' : 'd-none'} onClick={this.dropdownToggle}>
                    <div className="mobile-operation-menu-bg-layer"></div>
                    <div className="mobile-operation-menu">
                      <DropdownItem onClick={this.onFolderIconToggle} className="mobile-dropdown-item">
                        <span className="dtable-font dtable-icon-rename"></span>
                        <span className="mobile-dropdown-span">{gettext('Rename')}</span>
                      </DropdownItem>
                      <DropdownItem onClick={this.deleteFolder} className="mobile-dropdown-item">
                        <span className="dtable-font dtable-icon-delete"></span>
                        <span className="mobile-dropdown-span">{gettext('Delete')}</span>
                      </DropdownItem>
                    </div>
                  </div>
                </Dropdown>
              )}
            </div>
          </div>
          {this.state.isShowFolderIconSettings && (
            <ModalPortal>
              <FolderSettingsView
                onFolderSettingsToggle={this.onFolderIconToggle}
                folderName={name}
                onNameChange={this.onNameChange}
              />
            </ModalPortal>
          )}
        </>
      );
    }

    const active = this.state.active && !this.state.renaming;
    return (connectDropTarget(
      <div
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
        onClick={this.onOpenFolder}
        className={`table-item ${active ? 'tr-highlight' : ''} ${isOver ? 'tr-highlight' : ''}`}
      >
        {this.renderFolderIcon()}
        {this.renderFolderName()}
        <div className="table-dropdown-menu">
          {active && isOwnerOrAdmin &&
            <Fragment>
              <span className="table-icon-settings" onClick={this.onRename}
                title={gettext('Edit')} aria-label={gettext('Edit')}>
                <i className="dtable-font dtable-icon-rename cursor-pointer attr-action-icon"></i>
              </span>
              <Dropdown
                isOpen={this.state.dropdownOpen}
                toggle={this.dropdownToggle}
                direction="down"
                className="table-item-more-operation"
                onClick={this.onDropDownClick}
              >
                <DropdownToggle
                  tag="i"
                  role="button"
                  className="dtable-font dtable-icon-more-vertical cursor-pointer attr-action-icon table-dropdown-menu-icon"
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                  data-toggle="dropdown"
                  aria-expanded={this.state.dropdownOpen}
                  aria-haspopup={true}
                />
                <DropdownMenu className="dtable-dropdown-menu dropdown-menu">
                  <DropdownItem onClick={this.deleteFolder}>{gettext('Delete')}</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </Fragment>
          }
        </div>
      </div>
    ));
  }
}

DTableFolder.propTypes = dtableFolderPropTypes;

export default DTableFolder;
