import React from 'react';
import PropTypes from 'prop-types';
import { DragSource } from 'react-dnd';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import UserInfoPopover from './dtable-popover/user-info-popover';
import { Utils } from '../../utils/utils';
import DTableItem from './dtable-item';

const dragSource = {
  beginDrag: (props, monitor) => {
    return {
      data: props.view,
      mode: 'view'
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
  sharedViewItemIndex: PropTypes.number.isRequired,
  view: PropTypes.object.isRequired,
  leaveSharedView: PropTypes.func.isRequired,
  onFreezedItem: PropTypes.func,
  onUnfreezedItem: PropTypes.func,
  isItemFreezed: PropTypes.bool,
  onMoveFolderItemToggle: PropTypes.func.isRequired,
  folder: PropTypes.object,
};

class DTableItemViewShared extends React.Component {

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

  dropdownToggle = () => {
    if (this.state.dropdownOpen) {
      this.setState({ active: false });
      this.props.onUnfreezedItem();
    } else {
      this.props.onFreezedItem();
    }
    this.setState({ dropdownOpen: !this.state.dropdownOpen });
  };

  onShareMouseEnter = (event) => {
    const _this = this;
    this.handleTimer = setTimeout(() => {
      _this.setState({ isUserDetailPopoverShow: true });
    }, 500);
  };

  onShareMouseLeave = (event) => {
    clearTimeout(this.handleTimer);
    this.setState({ isUserDetailPopoverShow: false });
  };

  onLeaveShareViewSubmit = (e) => {
    e.stopPropagation();
    this.props.leaveSharedView(this.props.view);
  };

  onTableItemClick = (e, href) => {
    Utils.openPage(e, href);
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

  onMoveFolderItemToggle = () => {
    let { folder, view } = this.props;
    this.props.onMoveFolderItemToggle({
      name: view.shared_name,
      item_type: 'view',
      item: view,
      folder_id: folder ? folder.id : '/'
    });
  };

  render = () => {
    let { view, sharedViewItemIndex } = this.props;
    let { active, isUserDetailPopoverShow } = this.state;
    let { dtable_name, shared_name, from_user_name, from_user_avatar, id, color: dtableColor, icon: dtableIcon } = view;
    let tableHref = `${siteRoot}dtable-shared-view/personal/${id}/`;
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
              <DTableItem dtableColor={dtableColor} dtableIcon={dtableIcon} />
              <div className="table-name">
                <a href={tableHref} className="table-href">{shared_name || dtable_name}</a>
                <div className="dtable-sharer-information" onMouseEnter={this.onShareMouseEnter} onMouseLeave={this.onShareMouseLeave} id={`shared-view-item-${sharedViewItemIndex}`}>
                  <img className="dtable-sharer-avatar" src={from_user_avatar} alt={from_user_name} />
                  <span className="dtable-sharer-name">{from_user_name}</span>
                  <UserInfoPopover
                    target={`shared-view-item-${sharedViewItemIndex}`}
                    isUserDetailPopoverShow={isUserDetailPopoverShow}
                    userEmail={view.from_user}
                  >
                  </UserInfoPopover>
                </div>
              </div>
            </div>
          )}
          <div className="table-dropdown-menu">
            {active && (
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
                  <DropdownItem onClick={this.onLeaveShareViewSubmit}>{gettext('Leave share')}</DropdownItem>
                  <DropdownItem onClick={this.onMoveFolderItemToggle}>{gettext('Move to folder')}</DropdownItem>
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
        <DTableItem dtableColor={dtableColor} dtableIcon={dtableIcon} className="table-mobile-icon"/>
        <div className="table-mobile-name d-flex align-items-center">
          <a href={tableHref} className="table-href">{shared_name || dtable_name}</a>
          <div className="dtable-sharer-information">
            <img className="dtable-sharer-avatar" src={from_user_avatar} alt={from_user_name} />
            <span className="dtable-sharer-name">{from_user_name}</span>
          </div>
        </div>
        <div className="table-mobile-dropdown-menu">
          <i
            className="dtable-font dtable-icon-x table-dropdown-menu-icon"
            title={gettext('Leave share')}
            onClick={this.onLeaveShareViewSubmit}>
          </i>
        </div>
      </div>
    );
  };
}

DTableItemViewShared.propTypes = propTypes;

export default DragSource('Base', dragSource, dragCollect)(DTableItemViewShared);
