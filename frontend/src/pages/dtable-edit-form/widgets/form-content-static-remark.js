import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { DragSource, DropTarget } from 'react-dnd';
import DragIconTooltip from './drag-icon-tooltip';
import LongTextEditorUtils from '../../../components-form/utils/long-text-editor-utils';
import LongTextEditorPreviewAll from '../../../components-form/cell-editor-widgets/long-text-editor-preview-all';
import { isMobile } from '../../../utils/utils';

const gettext = window.gettext;

const { workspaceID, token, dtableWebURL } = window.shared.pageOptions;

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

class FormContentStaticRemark extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowOperationBtn: false,
    };
    this._editorUtils = new LongTextEditorUtils({
      editorType: 'remark-description',
      token,
      dtableWebURL,
      workspaceID,
      apiUploadLinkName: 'getUploadLinkViaFormToken'
    });
  }

  onMouseEnter = () => {
    const { draggedRow } = this.props;
    if (draggedRow) return;
    this.setState({ isShowOperationBtn: true });
  };

  onMouseLeave = () => {
    this.setState({ isShowOperationBtn: false });
  };

  onClick = () => {
    const { item } = this.props;
    this.props.updateSettingElement(item);
  };

  onDeleteRemarks = (event) => {
    event.stopPropagation();
    let { staticElements, elementsOrder, item } = this.props;
    const navTargetIdx = elementsOrder.findIndex(option => option.key === item.key);
    const staTargetIdx = staticElements.findIndex(option => option.key === item.key);
    elementsOrder.splice(navTargetIdx, 1);
    staticElements.splice(staTargetIdx, 1);
    this.props.onSave({ staticElements, elementsOrder });
    this.props.updateSettingElement(null);
  };

  render() {
    const { isShowOperationBtn } = this.state;
    const { staticElements, item, connectDragSource, connectDropTarget, connectDragPreview,
      isOver, isDragging, isEditing, canDrop, isEditFormPage, draggedRow, index } = this.props;
    const isCurrentElement = draggedRow && draggedRow.idx === index;
    const targetElement = staticElements.find(option => option.key === item.key);
    const value = targetElement.value;
    const remarkContent = value || gettext('Add notes or filling requirements here to guide the user (or filling person) to operate correctly');

    return (
      connectDropTarget(
        connectDragPreview(
          <div
            className={classnames('static-remark mt-1 mb-1',
              { 'compose-editor': !isEditFormPage },
              { 'setting-row-item': isEditFormPage },
              { 'hover-item': isShowOperationBtn },
              { 'setting-row-item-active': isEditing }
            )}
            onMouseEnter={this.onMouseEnter}
            onMouseLeave={this.onMouseLeave}
            onClick={this.onClick}
          >
            {isOver && canDrop && isDragging && !isCurrentElement && <div className="drop-placeholder mb-4"></div>}
            {isEditFormPage && !isMobile && isShowOperationBtn &&
              <>
                <div className="operation-button operation-button-delete" onClick={this.onDeleteRemarks}>
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
            <div className="remark-editor-content">
              <LongTextEditorPreviewAll
                newValue={{ text: remarkContent }}
                style={{ color: targetElement.text_color, backgroundColor: targetElement.background_color }}
              />
            </div>
            {isOver && canDrop && !isDragging && !isCurrentElement && <div className="drop-placeholder mt-4"></div>}
          </div>
        )
      )
    );
  }
}

FormContentStaticRemark.propTypes = {
  isOver: PropTypes.bool,
  canDrop: PropTypes.bool,
  isDragging: PropTypes.bool,
  isEditing: PropTypes.bool,
  isEditFormPage: PropTypes.bool,
  index: PropTypes.number,
  elementsOrder: PropTypes.array,
  staticElements: PropTypes.array,
  item: PropTypes.object,
  draggedRow: PropTypes.object,
  moveItem: PropTypes.func,
  addItem: PropTypes.func,
  onSave: PropTypes.func,
  connectDragSource: PropTypes.func,
  connectDropTarget: PropTypes.func,
  connectDragPreview: PropTypes.func,
  updateSettingElement: PropTypes.func,
};

export default DropTarget('DtableFormElements', dropTarget, dropCollect)(
  DragSource('DtableFormElements', dragSource, dragCollect)(FormContentStaticRemark)
);
