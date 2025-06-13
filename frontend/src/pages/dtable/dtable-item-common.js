import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { Utils, validateName } from '../../utils/utils';
import DtableSettingPopover from './dtable-popover/dtable-setting-popover';
import DTableItem from './dtable-item';
import { DragSource } from 'react-dnd';
import DTableVerifyPasswordDialog from './dialog/dtable-verify-password-dialog';

const dragSource = {
  beginDrag: (props, monitor) => {
    return {
      data: props.project,
      folder: props.folder,
      mode: 'drag-base'
    };
  },
  endDrag(props, monitor) {
    const optionSource = monitor.getItem();
    const didDrop = monitor.didDrop();
    let optionTarget = {};
    if (!didDrop) {
      return { optionSource, optionTarget };
    }
  },
};

const dragCollect = (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  connectDragPreview: connect.dragPreview(),
  isDragging: monitor.isDragging()
});

const gettext = window.gettext;
const siteRoot = window.app.config.siteRoot;

const propTypes = {
  connectDragSource: PropTypes.func,
  connectDropTarget: PropTypes.func,
  connectDragPreview: PropTypes.func,
  isOver: PropTypes.bool,
  canDrop: PropTypes.bool,
  isDragging: PropTypes.bool,
  project: PropTypes.object.isRequired,
  renameTable: PropTypes.func.isRequired,
  onDeleteTableToggle: PropTypes.func.isRequired,
  onShareTableToggle: PropTypes.func.isRequired,
  onSetPasswordToggle: PropTypes.func,
  onUnsetPasswordToggle: PropTypes.func,
  onModifyPasswordToggle: PropTypes.func,
  onTableSnapshotsToggle: PropTypes.func.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  isOwner: PropTypes.bool.isRequired,
  isAdmin: PropTypes.bool.isRequired,
  onAddStarDTable: PropTypes.func.isRequired,
  onUnstarDTable: PropTypes.func.isRequired,
  onMobileShareTableToggle: PropTypes.func,
  onMobileUpdateTableToggle: PropTypes.func,
  folder: PropTypes.object,
  onMoveFolderItemToggle: PropTypes.func,
  moveFolderItem: PropTypes.func,
  changeContainerColor: PropTypes.func,
  setDropdownState: PropTypes.func,
  getDropdownState: PropTypes.func,
  eventBus: PropTypes.object,
};

class DTableItemCommon extends React.Component {

  constructor(props) {
    super(props);
    const { name, color, icon } = props.project;
    this.state = {
      dropdownOpen: false,
      active: false,
      isShowTableIconSettings: false,
      dtableName: name,
      dtableColor: color,
      dtableIcon: icon,
      advancedDropdownOpen: false,
      isFinished: false,
      isShowVerifyPasswordDialog: false,
      isShowConfirmExportDialog: false,
      ignore_asset: 'false',
      size_limit: 0,
    };
    this.dropDownRef = React.createRef();
  }

  componentDidMount() {
    if (this.props.eventBus) {
      this.unsubscribe = this.props.eventBus.subscribe('folder-close', this.saveBaseProperty);
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.props.project.name !== nextProps.project.name) {
      this.setState({ dtableName: nextProps.project.name });
    }
  }

  componentWillUnmount() {
    if (this.props.eventBus) {
      this.unsubscribe();
    }
  }

  onMouseEnter = () => {
    if (this.props.getDropdownState && this.props.getDropdownState()) return;
    this.setState({ active: true });
  };

  onMouseLeave = () => {
    if (this.props.getDropdownState && this.props.getDropdownState()) return;
    if (this.state.isShowTableIconSettings) return;
    this.setState({ active: false, dropdownOpen: false });
  };

  onMobileUpdateTableToggle = () => {
    this.props.onMobileUpdateTableToggle(this.props.project);
  };

  onDeleteTableToggle = () => {
    this.props.onDeleteTableToggle(this.props.project);
  };

  onShareTableToggle = () => {
    this.props.onShareTableToggle(this.props.project);
  };

  onSetPasswordToggle = () => {
    this.props.onSetPasswordToggle(this.props.project);
  };

  onUnsetPasswordToggle = () => {
    this.props.onUnsetPasswordToggle(this.props.project);
  };

  onModifyPasswordToggle = () => {
    this.props.onModifyPasswordToggle(this.props.project);
  };

  onMobileShareTableToggle = () => {
    this.props.onMobileShareTableToggle(this.props.project);
  };

  onVerifyPasswordDialogToggle = () => {
    this.setState({ isShowVerifyPasswordDialog: !this.state.isShowVerifyPasswordDialog });
  };

  onConfirmExportDialogToggle = () => {
    this.setState({ isShowConfirmExportDialog: !this.state.isShowConfirmExportDialog });
  };

  dropdownToggle = (e) => {
    if (e.target.closest('.mobile-dropdown-item')) {
      return;
    }
    e.stopPropagation();
    if (this.state.dropdownOpen) {
      this.setState({ active: false });
    }
    if (this.props.setDropdownState) {
      this.props.setDropdownState(!this.state.dropdownOpen);
    }
    this.setState({ dropdownOpen: !this.state.dropdownOpen });
  };

  onAddStarDTable = () => {
    let { project } = this.props;
    this.props.onAddStarDTable(project);
  };

  onUnstarDTable = () => {
    let { project } = this.props;
    this.props.onUnstarDTable(project);
  };

  onTableIconToggle = (e) => {
    if (e) e.stopPropagation();
    this.setState({ isShowTableIconSettings: !this.state.isShowTableIconSettings }, () => {
      if (!this.state.isShowTableIconSettings) {
        this.setState({ active: false });
        this.saveBaseProperty();
      }
    });
  };

  saveBaseProperty = () => {
    const { color, name, icon } = this.props.project;
    const { dtableColor, dtableIcon } = this.state;
    let dtableName = this.state.dtableName.trim();
    let response = validateName(dtableName);
    if (!response.isValid) {
      toaster.danger(response.message);
      return;
    }
    dtableName = response.message;
    if (dtableColor !== color || dtableIcon !== icon || dtableName !== name) {
      let updated = {};
      if (dtableColor !== color) {
        updated.color = dtableColor;
      }
      if (dtableIcon !== icon) {
        updated.icon = dtableIcon;
      }
      if (dtableName !== name) {
        updated.new_name = dtableName;
      }
    }
  };

  onIconChange = (dtableIcon) => {
    this.setState({ dtableIcon });
  };

  onColorChange = (dtableColor) => {
    this.setState({ dtableColor });
  };

  onNameChange = (dtableName) => {
    this.setState({ dtableName });
  };

  onTableItemClick = (e, href) => {
    Utils.openPage(e, href);
  };


  toggleAdvancedMenu = (e) => {
    e.stopPropagation();
    this.setState({
      advancedDropdownOpen: !this.state.advancedDropdownOpen
    });
  };

  onAdvancedMouseEnter = () => {
    this.setState({
      advancedDropdownOpen: true
    });
  };

  onDropDownMouseMove = (e) => {
    if (this.state.advancedDropdownOpen && e.target && e.target.className === 'dropdown-item') {
      this.setState({
        advancedDropdownOpen: false
      });
    }
  };

  onAdvancedMouseMove = (e) => {
    e.stopPropagation();
  };

  onMoveFolderItemToggle = () => {
    let { folder, project } = this.props;
    this.props.onMoveFolderItemToggle({
      project,
      item_type: 'project',
      item_id: project.uuid,
      folder_id: folder ? folder.id : '/'
    });
  };

  onAdvanceMenuMouseDown = () => {
    if (this.props.setDropdownState) {
      this.props.setDropdownState(false);
    }
  };

  renderAdvancedMenu = () => {
    return (
      <Dropdown
        isOpen={this.state.advancedDropdownOpen}
        direction="right"
        toggle={this.toggleAdvancedMenu}
        className="advanced-menu"
        onMouseMove={this.onAdvancedMouseMove}
      >
        <DropdownToggle role="button" className="dropdown-item" onMouseEnter={this.onAdvancedMouseEnter}>
          <span>{gettext('Advanced')}</span>
          <span className="dtable-font dtable-icon-down3 rotate-270"></span>
        </DropdownToggle>
      </Dropdown>
    );
  };

  onDragStart = () => {
    if (this.dropDownRef.current) {
      this.dropDownRef.current.style.opacity = 0;
    }
  };

  onDragEnd = () => {
    if (this.dropDownRef.current) {
      this.dropDownRef.current.style.opacity = 1;
    }
  };

  render() {
    let { isOwner, isAdmin, project } = this.props;
    let { dtableName, dropdownOpen, dtableColor, dtableIcon, active } = this.state;
    let { workspace_id, uuid, id, name, is_encrypted, starred } = project;
    let tableHref = siteRoot + 'workspace/' + workspace_id + '/dtable/' + encodeURIComponent(project.name) + '/';
    const isDesktop = Utils.isDesktop();
    if (!isDesktop) {
      return (
        <div
          className="table-mobile-item"
          onClick={(e) => this.onTableItemClick(e, tableHref)}
        >
          <DTableItem dtableColor={project.color} dtableIcon={project.icon} className="table-mobile-icon"/>
          <div className="table-mobile-name d-flex align-items-center">
            <a href={tableHref}>{name}</a>
            {starred && <i className='dtable-font dtable-icon-star star'></i>}
            {is_encrypted && <i className='dtable-font dtable-icon-unlock star'></i>}
          </div>
          <div className="table-mobile-dropdown-menu">
            <Dropdown
              isOpen={this.state.dropdownOpen}
              toggle={this.dropdownToggle}
              direction="down"
              className="table-item-more-operation"
              onClick={(e) => {e.stopPropagation();}}
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
                  {(isOwner || isAdmin) &&
                    <Fragment>
                      <DropdownItem onClick={this.onMobileShareTableToggle} className="mobile-dropdown-item">
                        <span className="dtable-font dtable-icon-share"></span>
                        <span className="mobile-dropdown-span">{gettext('Share')}</span>
                      </DropdownItem>
                      <DropdownItem onClick={this.onMobileUpdateTableToggle} className="mobile-dropdown-item">
                        <span className="dtable-font dtable-icon-rename"></span>
                        <span className="mobile-dropdown-span">{gettext('Rename')}</span>
                      </DropdownItem>
                      <DropdownItem onClick={this.onDeleteTableToggle} className="mobile-dropdown-item">
                        <span className="dtable-font dtable-icon-delete"></span>
                        <span className="mobile-dropdown-span">{gettext('Delete')}</span>
                      </DropdownItem>
                      {starred ?
                        <DropdownItem onClick={this.onUnstarDTable} className="mobile-dropdown-item">
                          <span className="dtable-font dtable-icon-star"></span>
                          <span className="mobile-dropdown-span">{gettext('Unstar')}</span>
                        </DropdownItem>
                        :
                        <DropdownItem onClick={this.onAddStarDTable} className="mobile-dropdown-item">
                          <span className="dtable-font dtable-icon-star"></span>
                          <span className="mobile-dropdown-span">{gettext('Star')}</span>
                        </DropdownItem>
                      }
                      <DropdownItem divider />
                    </Fragment>
                  }
                </div>
              </div>
            </Dropdown>
          </div>

        </div>
      );
    }
    let tableIconSettingsId = `table_item_${workspace_id}_${uuid}_${id}`;
    const { connectDragSource, connectDragPreview, connectDropTarget, isOver, canDrop } = this.props;

    return (connectDropTarget(connectDragPreview(
      <div
        className={`table-item ${active ? 'tr-highlight' : ''} ${isOver && canDrop ? 'tr-highlight' : ''}`}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
        onClick={(e) => this.onTableItemClick(e, tableHref)}
      >
        {connectDragSource(
          <div className="table-item-drag-container ml-0" onDragStart={this.onDragStart} onDragEnd={this.onDragEnd}>
            <DTableItem dtableColor={project.color} dtableIcon={project.icon} />
            <div className="table-name">
              <a href={tableHref}>{project.name}</a>
              {starred && <i className='dtable-font dtable-icon-star star'></i>}
              {is_encrypted && <i className='dtable-font dtable-icon-unlock star'></i>}
            </div>
          </div>
        )}
        <div className="table-dropdown-menu" ref={this.dropDownRef}>
          {active && (
            <Fragment>
              {(isOwner || isAdmin) && (
                <span
                  className="table-icon-settings"
                  onClick={this.onTableIconToggle}
                  id={tableIconSettingsId}
                  title={gettext('Edit')}
                  aria-label={gettext('Edit')}
                >
                  <i className="dtable-font dtable-icon-rename cursor-pointer attr-action-icon"></i>
                </span>
              )}
              <Dropdown
                isOpen={dropdownOpen}
                toggle={this.dropdownToggle}
                direction="down"
                className="table-item-more-operation"
              >
                <DropdownToggle
                  tag='i'
                  role="button"
                  className='dtable-font dtable-icon-more-vertical cursor-pointer attr-action-icon table-dropdown-menu-icon'
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                  data-toggle="dropdown"
                  aria-expanded={dropdownOpen}
                  aria-haspopup={true}
                >
                </DropdownToggle>
                <DropdownMenu className="dtable-dropdown-menu dropdown-menu drop-list" right={true} onMouseMove={this.onDropDownMouseMove}>
                  {(isOwner || isAdmin) && <DropdownItem onClick={this.onShareTableToggle}>{gettext('Share')}</DropdownItem>}
                  {starred ?
                    <DropdownItem onClick={this.onUnstarDTable}>{gettext('Unstar')}</DropdownItem>
                    :
                    <DropdownItem onClick={this.onAddStarDTable}>{gettext('Star')}</DropdownItem>
                  }
                  {(isOwner || isAdmin) && <DropdownItem onClick={this.onDeleteTableToggle}>{gettext('Delete')}</DropdownItem>}
                  <DropdownItem divider />
                  {(isOwner || isAdmin) && <DropdownItem onClick={this.onMoveFolderItemToggle}>{gettext('Move to folder')}</DropdownItem>}
                  <DropdownItem divider />
                  {(isOwner || isAdmin) &&
                    <>
                      {project.is_encrypted ?
                        <Fragment>
                          <DropdownItem onClick={this.onUnsetPasswordToggle}>{gettext('Unset password')}</DropdownItem>
                          <DropdownItem onClick={this.onModifyPasswordToggle}>{gettext('Modify password')}</DropdownItem>
                        </Fragment>
                        :
                        <DropdownItem onClick={this.onSetPasswordToggle}>{gettext('Set password')}</DropdownItem>
                      }
                    </>
                  }
                  {(isOwner || isAdmin) && this.renderAdvancedMenu()}
                </DropdownMenu>
              </Dropdown>
            </Fragment>
          )}
        </div>
        {this.state.isShowTableIconSettings && (
          <DtableSettingPopover
            tableIconSettingsId={tableIconSettingsId}
            onTableIconToggle={this.onTableIconToggle}
            dtableName={dtableName}
            dtableColor={dtableColor}
            dtableIcon={dtableIcon}
            onColorChange={this.onColorChange}
            onIconChange={this.onIconChange}
            onNameChange={this.onNameChange}
          />
        )}
        {this.state.isShowVerifyPasswordDialog &&
          <DTableVerifyPasswordDialog
            dtable={this.props.project}
            toggle={this.onVerifyPasswordDialogToggle}
            ignore_asset={this.state.ignore_asset}
          />
        }
      </div>
    )));
  }
}

DTableItemCommon.propTypes = propTypes;

export default DragSource('Base', dragSource, dragCollect)(DTableItemCommon);
