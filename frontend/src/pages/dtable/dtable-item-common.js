import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import DTableIODialog from './dialog/dtable-io-dialog';
import { Utils, validateName } from '../../utils/utils';
import { dtableWebAPI } from '../../api/dtable-web-api';
import { canAddDTable } from '../../utils/constants';
import DtableSettingPopover from './dtable-popover/dtable-setting-popover';
import DTableItem from './dtable-item';
import { DragSource } from 'react-dnd';
import DTableVerifyPasswordDialog from './dialog/dtable-verify-password-dialog';
import ConfirmDTableExportDialog from '../../components/dialog/confirm-dtable-export-dialog';

const dragSource = {
  beginDrag: (props, monitor) => {
    return {
      data: props.table,
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
  table: PropTypes.object.isRequired,
  renameTable: PropTypes.func.isRequired,
  onDeleteTableToggle: PropTypes.func.isRequired,
  onShareTableToggle: PropTypes.func.isRequired,
  onSetPasswordToggle: PropTypes.func,
  onUnsetPasswordToggle: PropTypes.func,
  onModifyPasswordToggle: PropTypes.func,
  onTableSnapshotsToggle: PropTypes.func.isRequired,
  onTableAPITokenToggle: PropTypes.func.isRequired,
  onWebhookToggle: PropTypes.func.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  onCopyDTableToggle: PropTypes.func.isRequired,
  isOwner: PropTypes.bool.isRequired,
  isAdmin: PropTypes.bool.isRequired,
  onAddStarDTable: PropTypes.func.isRequired,
  onUnstarDTable: PropTypes.func.isRequired,
  onUpdateTable: PropTypes.func.isRequired,
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
    const { name, color, icon } = props.table;
    this.state = {
      dropdownOpen: false,
      active: false,
      isShowDTableIODialog: false,
      IOTaskId: 0,
      currentExportingTable: null,
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
    if (this.props.table.name !== nextProps.table.name) {
      this.setState({ dtableName: nextProps.table.name });
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
    this.props.onMobileUpdateTableToggle(this.props.table);
  };

  onDeleteTableToggle = () => {
    this.props.onDeleteTableToggle(this.props.table);
  };

  onShareTableToggle = () => {
    this.props.onShareTableToggle(this.props.table);
  };

  onSetPasswordToggle = () => {
    this.props.onSetPasswordToggle(this.props.table);
  };

  onUnsetPasswordToggle = () => {
    this.props.onUnsetPasswordToggle(this.props.table);
  };

  onModifyPasswordToggle = () => {
    this.props.onModifyPasswordToggle(this.props.table);
  };

  onMobileShareTableToggle = () => {
    this.props.onMobileShareTableToggle(this.props.table);
  };

  onTableSnapshotsToggle = () => {
    this.props.onTableSnapshotsToggle(this.props.table);
  };

  onDTableIODialogToggle = () => {
    this.setState({ isShowDTableIODialog: !this.state.isShowDTableIODialog });
  };

  onVerifyPasswordDialogToggle = () => {
    this.setState({ isShowVerifyPasswordDialog: !this.state.isShowVerifyPasswordDialog });
  };

  onConfirmExportDialogToggle = () => {
    this.setState({ isShowConfirmExportDialog: !this.state.isShowConfirmExportDialog });
  };

  onExportDTable = () => {
    const { uuid } = this.props.table;
    dtableWebAPI.getDTableAssetSize(uuid).then(res => {
      let can_export_asset = res.data.can_export_asset;
      let size_limit = res.data.max_size_of_export;
      this.setState({
        ignore_asset: can_export_asset ? 'false' : 'true',
        size_limit: size_limit
      });
      if (can_export_asset) {
        this.onConfirmExportDTable('false');
      } else {
        this.onConfirmExportDialogToggle();
      }
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onConfirmExportDTable = (ignore_asset) => {
    const { table } = this.props;
    if (table.is_encrypted) {
      this.onVerifyPasswordDialogToggle();
    } else {
      this.exportDTable(ignore_asset);
    }
  };

  exportDTable = (ignore_asset = null, password = null) => {
    let task_id = '';
    const { workspace_id, name, uuid } = this.props.table;
    dtableWebAPI.addExportDTableTask(workspace_id, name, password, ignore_asset).then(res => {
      task_id = res.data.task_id;
      this.setState({
        isShowDTableIODialog: true,
        IOTaskId: task_id,
        currentExportingTable: res.data.table,
      });
      return dtableWebAPI.queryDTableIOStatusByTaskId(task_id);
    }).then(res => {
      if (res.data.is_finished === true) {
        this.setState({ isShowDTableIODialog: false });
        location.href = siteRoot + 'dtable-export-content/?task_id=' + task_id + '&dtable_uuid=' + uuid;
      } else {
        this.timer = setInterval(() => {
          dtableWebAPI.queryDTableIOStatusByTaskId(task_id).then(res => {
            if (res.data.is_finished === true) {
              this.setState({ isFinished: true });
              clearInterval(this.timer);
              this.setState({ isShowDTableIODialog: false });
              location.href = siteRoot + 'dtable-export-content/?task_id=' + task_id + '&dtable_uuid=' + uuid;
            }
          }).catch(error => {
            if (this.state.isFinished === false) {
              clearInterval(this.timer);
              this.setState({ isShowDTableIODialog: false });
              toaster.danger(gettext('Failed to export. Please check whether the size of table attachments exceeds the limit.'));
            }
          });
        }, 1000);
      }
      this.setState({ isFinished: false });
    }).catch(error => {
      this.setState({ isShowDTableIODialog: false });
      if (error.response && error.response.status === 500) {
        const error_msg = error.response.data ? error.response.data['error_msg'] : null;
        if (error_msg && error_msg !== 'Internal Server Error') {
          toaster.danger(error_msg);
        } else {
          toaster.danger(gettext('Internal Server Error.'));
        }
      } else {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      }
    });
  };

  cancelDTableIOTask = () => {
    clearInterval(this.timer);
    let dtable_uuid = this.state.currentExportingTable.uuid;
    dtableWebAPI.cancelDTableIOTask(this.state.IOTaskId, dtable_uuid, 'export').then(res => {
      this.setState({
        isShowDTableIODialog: false,
        IOTaskId: 0,
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onTableAPITokenToggle = () => {
    this.props.onTableAPITokenToggle(this.props.table);
  };

  onWebhookToggle = () => {
    this.props.onWebhookToggle(this.props.table);
  };

  onCopyDTableToggle = () => {
    this.props.onCopyDTableToggle(this.props.table);
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
    let { table } = this.props;
    this.props.onAddStarDTable(table);
  };

  onUnstarDTable = () => {
    let { table } = this.props;
    this.props.onUnstarDTable(table);
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
    const { color, name, icon } = this.props.table;
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
      this.props.onUpdateTable(name, updated);
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
    let { folder, table } = this.props;
    this.props.onMoveFolderItemToggle({
      table,
      item_type: 'dtable',
      item_id: table.uuid,
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
        <DropdownMenu className="dtable-dropdown-menu dropdown-menu" onMouseDown={this.onAdvanceMenuMouseDown}>
          <DropdownItem onClick={this.onTableAPITokenToggle}>{gettext('API Token')}</DropdownItem>
          <DropdownItem onClick={this.onWebhookToggle}>{gettext('Webhooks')}</DropdownItem>
        </DropdownMenu>
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
    let { isOwner, isAdmin, table } = this.props;
    let { dtableName, dropdownOpen, dtableColor, dtableIcon, active } = this.state;
    let { workspace_id, uuid, id, name, is_encrypted, starred } = table;
    let tableHref = siteRoot + 'workspace/' + workspace_id + '/dtable/' + encodeURIComponent(table.name) + '/';
    const isDesktop = Utils.isDesktop();
    if (!isDesktop) {
      return (
        <div
          className="table-mobile-item"
          onClick={(e) => this.onTableItemClick(e, tableHref)}
        >
          <DTableItem dtableColor={table.color} dtableIcon={table.icon} className="table-mobile-icon"/>
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
                  {canAddDTable && (
                    <DropdownItem onClick={this.onCopyDTableToggle} className="mobile-dropdown-item">
                      <span className="dtable-font dtable-icon-copy"></span>
                      <span className="mobile-dropdown-span">{gettext('Copy')}</span>
                    </DropdownItem>
                  )}
                  <DropdownItem onClick={this.onExportDTable} className="mobile-dropdown-item">
                    <span className="dtable-font dtable-icon-export"></span>
                    <span className="mobile-dropdown-span">{gettext('Export')}</span>
                  </DropdownItem>
                  <DropdownItem divider />
                  <DropdownItem onClick={this.onTableSnapshotsToggle} className="mobile-dropdown-item">
                    <span className="dtable-font dtable-icon-history-mirror-image"></span>
                    <span className="mobile-dropdown-span">{gettext('Snapshots')}</span>
                  </DropdownItem>
                </div>
              </div>
            </Dropdown>
          </div>
          {this.state.isShowDTableIODialog && (
            <DTableIODialog
              isExporting={true}
              toggle={this.onDTableIODialogToggle}
              cancelDTableIOTask={this.cancelDTableIOTask}
            />
          )}

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
            <DTableItem dtableColor={table.color} dtableIcon={table.icon} />
            <div className="table-name">
              <a href={tableHref}>{table.name}</a>
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
                  {canAddDTable && <DropdownItem onClick={this.onCopyDTableToggle}>{gettext('Copy')}</DropdownItem>}
                  <DropdownItem onClick={this.onExportDTable}>{gettext('Export')}</DropdownItem>
                  <DropdownItem divider />
                  {(isOwner || isAdmin) &&
                    <>
                      {table.is_encrypted ?
                        <Fragment>
                          <DropdownItem onClick={this.onUnsetPasswordToggle}>{gettext('Unset password')}</DropdownItem>
                          <DropdownItem onClick={this.onModifyPasswordToggle}>{gettext('Modify password')}</DropdownItem>
                        </Fragment>
                        :
                        <DropdownItem onClick={this.onSetPasswordToggle}>{gettext('Set password')}</DropdownItem>
                      }
                    </>
                  }
                  <DropdownItem onClick={this.onTableSnapshotsToggle}>{gettext('Snapshots')}</DropdownItem>
                  {(isOwner || isAdmin) && this.renderAdvancedMenu()}
                </DropdownMenu>
              </Dropdown>
            </Fragment>
          )}
        </div>
        {this.state.isShowDTableIODialog && (
          <DTableIODialog
            isExporting={true}
            toggle={this.onDTableIODialogToggle}
            cancelDTableIOTask={this.cancelDTableIOTask}
          />
        )}
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
            dtable={this.props.table}
            toggle={this.onVerifyPasswordDialogToggle}
            exportDTable={this.exportDTable}
            ignore_asset={this.state.ignore_asset}
          />
        }
        {this.state.isShowConfirmExportDialog &&
          <ConfirmDTableExportDialog
            toggle={this.onConfirmExportDialogToggle}
            onConfirmExportDTable={this.onConfirmExportDTable}
            sizeLimit={this.state.size_limit}
          />
        }
      </div>
    )));
  }
}

DTableItemCommon.propTypes = propTypes;

export default DragSource('Base', dragSource, dragCollect)(DTableItemCommon);
