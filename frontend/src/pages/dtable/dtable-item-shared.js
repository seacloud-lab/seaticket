import React from 'react';
import PropTypes from 'prop-types';
import { DragSource } from 'react-dnd';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { Utils } from '../../utils/utils';
import UserInfoPopover from './dtable-popover/user-info-popover';
import { canAddDTable } from '../../utils/constants';
import DTableItem from './dtable-item';

const dragSource = {
  beginDrag: (props, monitor) => {
    return {
      data: props.table,
      mode: 'dtable'
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
const { siteRoot } = window.app.config;

const propTypes = {
  connectDragSource: PropTypes.func,
  connectDropTarget: PropTypes.func,
  connectDragPreview: PropTypes.func,
  isOver: PropTypes.bool,
  canDrop: PropTypes.bool,
  isDragging: PropTypes.bool,
  table: PropTypes.object.isRequired,
  sharedItemIndex: PropTypes.number,
  leaveShareTable: PropTypes.func.isRequired,
  onFreezedItem: PropTypes.func,
  onUnfreezedItem: PropTypes.func,
  onCopyDTableToggle: PropTypes.func.isRequired,
  isItemFreezed: PropTypes.bool,
  onMoveFolderItemToggle: PropTypes.func.isRequired,
  folder: PropTypes.object,
};

class DTableItemShared extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      active: false,
      isUserDetailPopoverShow: false,
      dropdownOpen: false,
    };
    this.dropDownRef = React.createRef();
  }

  onMouseEnter = () => {
    if (this.props.isItemFreezed) return;
    this.setState({ active: true });
  };

  onMouseLeave = () => {
    if (this.props.isItemFreezed) return;
    this.setState({ active: false, dropdownOpen: false });
  };

  onLeaveShareTableSubmit = (e) => {
    e.stopPropagation();
    let table = this.props.table;
    this.props.leaveShareTable(table);
  };

  onShareMouseEnter = () => {
    const _this = this;
    this.handleTimer = setTimeout(() => {
      _this.setState({ isUserDetailPopoverShow: true });
    }, 500);
  };

  onShareMouseLeave = () => {
    clearTimeout(this.handleTimer);
    this.setState({ isUserDetailPopoverShow: false });
  };

  dropdownToggle = () => {
    if (this.state.dropdownOpen) {
      this.setState({ active: false });
      this.props.onUnfreezedItem();
    } else {
      this.props.onFreezedItem();
    }
    this.setState({ dropdownOpen: !this.state.dropdownOpen });
  };

  onCopyDTableToggle = () => {
    this.props.onCopyDTableToggle(this.props.table);
  };

  onTableItemClick = (e, href) => {
    Utils.openPage(e, href);
  };

  onMoveFolderItemToggle = () => {
    let { folder, table } = this.props;
    this.props.onMoveFolderItemToggle({
      name: table.name,
      item_type: 'dtable',
      item: table,
      folder_id: folder ? folder.id : '/'
    });
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

  render = () => {
    let { table, sharedItemIndex } = this.props;
    let is_from_group = table.from_user.indexOf('@seafile_group') !== -1;
    let { active, isUserDetailPopoverShow } = this.state;
    let { name, from_user_name, from_user_avatar, workspace_id, color, icon, permission, is_encrypted } = table;
    let canCopy = canAddDTable && (permission === 'r' || permission === 'rw');
    let tableHref = siteRoot + 'workspace/' + workspace_id + '/dtable/' + encodeURIComponent(name) + '/';
    const isDesktop = Utils.isDesktop();
    if (isDesktop) {
      const { connectDragSource, connectDragPreview, connectDropTarget, isOver, canDrop } = this.props;
      return (connectDropTarget(connectDragPreview(
        <div
          onMouseEnter={this.onMouseEnter}
          onMouseLeave={this.onMouseLeave}
          onClick={(e) => this.onTableItemClick(e, tableHref)}
          className={`table-item ${active ? 'tr-highlight' : ''} ${isOver && canDrop ? 'tr-highlight' : ''}`}
        >
          {connectDragSource(
            <div className="table-item-drag-container ml-0" onDragStart={this.onDragStart} onDragEnd={this.onDragEnd}>
              <DTableItem dtableColor={color} dtableIcon={icon} />
              <div className="table-name">
                <a href={tableHref} className="table-href">{name}</a>
                <div className="dtable-sharer-information" onMouseEnter={this.onShareMouseEnter} onMouseLeave={this.onShareMouseLeave} id={`shared-item-${sharedItemIndex}`}>
                  <img className="dtable-sharer-avatar" src={from_user_avatar} alt={from_user_name} />
                  <span className="dtable-sharer-name">{from_user_name}</span>
                  <UserInfoPopover
                    target={`shared-item-${sharedItemIndex}`}
                    isUserDetailPopoverShow={!is_from_group && isUserDetailPopoverShow}
                    userEmail={table.from_user}
                  >
                  </UserInfoPopover>
                </div>
                {is_encrypted && <i className='dtable-font dtable-icon-unlock star'></i>}
              </div>
            </div>
          )}
          <div className="table-dropdown-menu" ref={this.dropDownRef}>
            {this.state.active && (
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
                  className='dtable-font dtable-icon-more-vertical cursor-pointer attr-action-icon table-dropdown-menu-icon'
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                  data-toggle="dropdown"
                  aria-expanded={this.state.dropdownOpen}
                  aria-haspopup={true}
                >
                </DropdownToggle>
                <DropdownMenu className="dtable-dropdown-menu dropdown-menu drop-list" right={true}>
                  <DropdownItem onClick={this.onLeaveShareTableSubmit}>{gettext('Leave share')}</DropdownItem>
                  <DropdownItem onClick={this.onMoveFolderItemToggle}>{gettext('Move to folder')}</DropdownItem>
                  {canCopy && <DropdownItem onClick={this.onCopyDTableToggle}>{gettext('Copy')}</DropdownItem>}
                </DropdownMenu>
              </Dropdown>
            )}
          </div>
        </div>
      )));
    }
    return (
      <div
        className="table-mobile-item"
        onClick={(e) => this.onTableItemClick(e, tableHref)}
      >
        <DTableItem dtableColor={color} dtableIcon={icon} className="table-mobile-icon"/>
        <div className="table-mobile-name d-flex align-items-center">
          <a href={tableHref} className="table-href">{name}</a>
          <div className="dtable-sharer-information">
            <img className="dtable-sharer-avatar" src={from_user_avatar} alt={from_user_name} />
            <span className="dtable-sharer-name">{from_user_name}</span>
          </div>
          {is_encrypted && <i className='dtable-font dtable-icon-unlock star'></i>}
        </div>
        <div className="table-mobile-dropdown-menu">
          <i
            className="dtable-font dtable-icon-x table-dropdown-menu-icon"
            title={gettext('Leave share')}
            onClick={this.onLeaveShareTableSubmit}>
          </i>
        </div>
      </div>
    );
  };
}

DTableItemShared.propTypes = propTypes;

export default DragSource('Base', dragSource, dragCollect)(DTableItemShared);
