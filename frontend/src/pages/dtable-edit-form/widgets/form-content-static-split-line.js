import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { DragSource, DropTarget } from 'react-dnd';
import DragIconTooltip from './drag-icon-tooltip';
import { isMobile } from '../../../utils/utils';

const dragSource = {
  beginDrag: props => {
    return { idx: props.index };
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
    let optionTarget = { idx: targetIdx };
    if (optionSource.idx === -1) {
      props.addItem(optionSource, optionTarget);
    } else if (targetIdx !== optionSource.idx) {
      props.moveItem(optionSource, optionTarget);
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

class FormContentStaticSplitLine extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowOperationBtn: false
    };
  }

  onMouseEnter = () => {
    const { draggedRow } = this.props;
    if (draggedRow) return;
    this.setState({ isShowOperationBtn: true });
  };

  onMouseLeave = () => {
    this.setState({ isShowOperationBtn: false });
  };

  onDeleteSplitLine = (event) => {
    event.stopPropagation();
    let { elementsOrder, staticElements, item } = this.props;
    const navTargetIdx = elementsOrder.findIndex(option => option.key === item.key);
    const staTargetIdx = staticElements.findIndex(option => option.key === item.key);
    elementsOrder.splice(navTargetIdx, 1);
    staticElements.splice(staTargetIdx, 1);
    this.props.onSave({ staticElements, elementsOrder });
  };

  render() {
    const { connectDragSource, connectDropTarget, connectDragPreview, draggedRow,
      isDragging, canDrop, isOver, index, isEditFormPage } = this.props;
    const { isShowOperationBtn } = this.state;
    const isCurrentElement = draggedRow && draggedRow.idx === index;

    return (
      connectDropTarget(
        connectDragPreview(
          <div
            className={classnames('form-split-line',
              { 'compose-editor': !isEditFormPage },
              { 'setting-row-item': isEditFormPage },
              { 'hover-item': isShowOperationBtn }
            )}
            onMouseEnter={this.onMouseEnter}
            onMouseLeave={this.onMouseLeave}
          >
            {isOver && canDrop && isDragging && !isCurrentElement && <div className="drop-placeholder mb-4"></div>}
            {isEditFormPage && !isMobile && isShowOperationBtn &&
              <>
                <div className="operation-button operation-button-delete" onClick={this.onDeleteSplitLine}>
                  <i className="dtable-font dtable-icon-delete"></i>
                </div>
                {connectDragSource(
                  <div className="operation-button operation-button-drag" id="drag-button">
                    <i className="dtable-font dtable-icon-drag"></i>
                    <DragIconTooltip showTooltip={!draggedRow} />
                  </div>
                )}
              </>
            }
            <div className="split-line"></div>
            {isOver && canDrop && !isDragging && !isCurrentElement && <div className="drop-placeholder mt-4"></div>}
          </div>
        )
      )
    );
  }
}

FormContentStaticSplitLine.propTypes = {
  isOver: PropTypes.bool,
  canDrop: PropTypes.bool,
  isDragging: PropTypes.bool,
  isEditFormPage: PropTypes.bool,
  index: PropTypes.number,
  elementsOrder: PropTypes.array,
  staticElements: PropTypes.array,
  draggedRow: PropTypes.object,
  item: PropTypes.object,
  onSave: PropTypes.func,
  moveItem: PropTypes.func,
  addItem: PropTypes.func,
  connectDragSource: PropTypes.func,
  connectDropTarget: PropTypes.func,
  connectDragPreview: PropTypes.func,
};

export default DropTarget('DtableFormElements', dropTarget, dropCollect)(
  DragSource('DtableFormElements', dragSource, dragCollect)(FormContentStaticSplitLine)
);
