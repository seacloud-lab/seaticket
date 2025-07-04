import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Link } from '@gatsbyjs/reach-router';
import { useDrag, useDrop } from 'react-dnd';

const siteRoot = window.app.config.siteRoot;

const SidePanelGroupItem = ({ isDepart, item, index, getActiveClass, onGroupTabClick, isOpenGroupExpanded, onMove }) => {
  const dragRef = useRef(null);
  const dropRef = useRef(null);

  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: 'SidePanelGroupItem',
    item: () => ({ idx: index, data: item }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: (item, monitor) => {
      const groupSource = item;
      const didDrop = monitor.didDrop();
      if (!didDrop) {
        return { groupSource, groupTarget: {} };
      }
    },
    isDragging: (monitor) => {
      const draggedRow = monitor.getItem();
      return draggedRow.idx > index;
    },
  });

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'SidePanelGroupItem',
    drop: (groupSource) => {
      if (index !== groupSource.idx) {
        const groupTarget = { idx: index, data: item };
        onMove(groupSource, groupTarget);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const tabIndex = isOpenGroupExpanded ? 0 : -1;
  drag(dragRef);
  drop(dropRef);

  return (
    <div ref={dropRef} key={item.id}>
      <div
        ref={dragPreview}
        className={classnames('nav-item workspace-nav-item',
          { 'seatable-bg-orange active': getActiveClass(`dtable/${item.id}`) === 'active' },
          { 'group-can-drop': isOver && canDrop && !isDragging },
          { 'group-can-drop-top': isOver && canDrop && isDragging }
        )}
        onClick={(event) => onGroupTabClick(event, `dtable/${item.id}`)}
      >
        <span
          ref={dragRef}
          className={classnames('drop-button',
            { 'drop-button-active': getActiveClass(`dtable/${item.id}`) === 'active' }
          )}
        >
          <i className="dtable-font dtable-icon-drag"></i>
        </span>
        <Link tabIndex={tabIndex} to={siteRoot + 'dtable/' + item.id + '/'} className="workspace-nav-link ellipsis">
          <span
            className={`table-workspace-icon dtable-font dtable-icon-${isDepart ? 'department' : 'collaborator'}`}
            aria-hidden="true"
          >
          </span>
          <span className="nav-text">{item.name}</span>
        </Link>
      </div>
    </div>
  );
};


SidePanelGroupItem.propTypes = {
  isDepart: PropTypes.bool,
  isOpenGroupExpanded: PropTypes.bool,
  index: PropTypes.number,
  item: PropTypes.object,
  getActiveClass: PropTypes.func,
  onGroupTabClick: PropTypes.func,
  onMove: PropTypes.func,
};

export default SidePanelGroupItem;
