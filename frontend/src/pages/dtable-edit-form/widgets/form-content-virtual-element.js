import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DropTarget } from 'react-dnd';

const dropTarget = {
  drop(props, monitor) {
    const optionSource = monitor.getItem();
    const { index: targetIdx } = props;
    let optionTarget = { idx: targetIdx };
    if (optionSource.idx === -1) {
      props.addItem(optionSource, optionTarget);
    }
  }
};

const dropCollect = (connect, monitor) => ({
  connectDropTarget: connect.dropTarget(),
  isOver: monitor.isOver(),
  canDrop: monitor.canDrop(),
  draggedRow: monitor.getItem(),
});

class FormContentVirtualElement extends Component {

  render() {
    // The virtual element is used to add element in form header
    const { connectDropTarget, isOver, canDrop, draggedRow } = this.props;
    const canAdd = draggedRow && draggedRow.idx === -1;

    return (
      connectDropTarget(
        <div className={`virtual-element ${isOver && canDrop && canAdd ? 'drop-placeholder' : ''}`}></div>
      )
    );
  }
}

FormContentVirtualElement.propTypes = {
  isOver: PropTypes.bool,
  canDrop: PropTypes.bool,
  draggedRow: PropTypes.object,
  addItem: PropTypes.func,
  connectDropTarget: PropTypes.func,
};

export default DropTarget('DtableFormElements', dropTarget, dropCollect)(FormContentVirtualElement);
