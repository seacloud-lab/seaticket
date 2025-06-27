import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Link } from '@gatsbyjs/reach-router';
import { DragSource, DropTarget } from 'react-dnd';

const propTypes = {
  isDepart: PropTypes.bool,
  isOver: PropTypes.bool,
  canDrop: PropTypes.bool,
  isDragging: PropTypes.bool,
  isOpenGroupExpanded: PropTypes.bool,
  index: PropTypes.number,
  item: PropTypes.object,
  getActiveClass: PropTypes.func,
  onGroupTabClick: PropTypes.func,
  connectDropTarget: PropTypes.func,
  connectDragSource: PropTypes.func,
  connectDragPreview: PropTypes.func,
};

const dragSource = {
  beginDrag: props => {
    return { data: props.item, idx: props.index };
  },
  endDrag(props, monitor) {
    const optionSource = monitor.getItem();
    const didDrop = monitor.didDrop();
    let optionTarget = {};
    if (!didDrop) {
      return { optionSource, optionTarget };
    }
  },
  isDragging(props) {
    const { index, draggedRow } = props;
    const { idx } = draggedRow;
    return idx > index;
  }
};

const dropTarget = {
  drop(props, monitor) {
    const optionSource = monitor.getItem();
    const { index: targetIdx } = props;
    if (targetIdx !== optionSource.idx) {
      let optionTarget = { idx: targetIdx, data: props.item };
      props.moveGroupItem(optionSource, optionTarget);
    }
  }
};

const dragCollect = (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  connectDragPreview: connect.dragPreview(),
  isDragging: monitor.isDragging(),
});

const dropCollect = (connect, monitor) => ({
  connectDropTarget: connect.dropTarget(),
  isOver: monitor.isOver(),
  canDrop: monitor.canDrop(),
  draggedRow: monitor.getItem()
});

const siteRoot = window.app.config.siteRoot;

class SidePanelGroupItem extends Component {

  render() {
    const { isDepart, item, getActiveClass, onGroupTabClick, connectDragSource,
      connectDropTarget, connectDragPreview, isOver, canDrop, isDragging, isOpenGroupExpanded } = this.props;
    const tabIndex = isOpenGroupExpanded ? 0 : -1;

    return connectDropTarget(
      connectDragPreview(
        <div
          key={item.id}
          className={classnames('nav-item workspace-nav-item',
            { 'seatable-bg-orange active': getActiveClass(`dtable/${item.id}`) === 'active' },
            { 'group-can-drop': isOver && canDrop && !isDragging },
            { 'group-can-drop-top': isOver && canDrop && isDragging }
          )}
          onClick={(event) => onGroupTabClick(event, `dtable/${item.id}`)}
        >
          {connectDragSource(
            <span
              className={classnames('drop-button',
                { 'drop-button-active': getActiveClass(`dtable/${item.id}`) === 'active' }
              )}
            >
              <i className="dtable-font dtable-icon-drag"></i>
            </span>
          )}
          <Link tabIndex={tabIndex} to={siteRoot + 'dtable/' + item.id + '/'} className="workspace-nav-link ellipsis">
            <span
              className={`table-workspace-icon dtable-font dtable-icon-${isDepart ? 'department' : 'collaborator'}`}
              aria-hidden="true"
            >
            </span>
            <span className="nav-text">{item.name}</span>
          </Link>
        </div>
      )
    );
  }
}

SidePanelGroupItem.propTypes = propTypes;

export default DropTarget('SidePanelGroupItem', dropTarget, dropCollect)(
  DragSource('SidePanelGroupItem', dragSource, dragCollect)(SidePanelGroupItem)
);
