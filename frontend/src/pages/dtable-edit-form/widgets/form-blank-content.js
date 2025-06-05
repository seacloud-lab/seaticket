import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DropTarget } from 'react-dnd';

const gettext = window.gettext;

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
  draggedRow: monitor.getItem()
});

class FormBlankContent extends Component {

  render() {
    const { connectDropTarget, draggedRow } = this.props;
    const isDragging = draggedRow && draggedRow.idx === -1;
    return (
      connectDropTarget(
        <div className={`form-content-no-fields ${isDragging ? 'dragging-add-field' : ''} d-flex align-items-center justify-content-center`}>
          {isDragging ?
            <i className="dtable-font dtable-icon-add-table"></i> :
            <span>{gettext('Please add fields in the form settings')}</span>
          }
        </div>
      )
    );
  }
}

FormBlankContent.propTypes = {
  draggedRow: PropTypes.object,
  addItem: PropTypes.func,
  connectDropTarget: PropTypes.func,
};

export default DropTarget('DtableFormElements', dropTarget, dropCollect)(FormBlankContent);
