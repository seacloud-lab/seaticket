import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DragSource } from 'react-dnd';
import { COLUMNS_ICON_CONFIG } from 'dtable-utils';
import { FORM_ELEMENTS_TYPE } from '../../../constants/form-constants';

const dragSource = {
  beginDrag: props => {
    return { idx: -1, type: FORM_ELEMENTS_TYPE.COLUMN, key: props.column.key };
  },

  endDrag(props, monitor) {
    const optionSource = monitor.getItem();
    const didDrop = monitor.didDrop();
    let optionTarget = {};
    if (!didDrop) {
      return { optionSource, optionTarget };
    }
  }
};

const dragCollect = (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  connectDragPreview: connect.dragPreview(),
  isDragging: monitor.isDragging(),
});

class FormSettingColumnItem extends Component {

  onClick = () => {
    const { column } = this.props;
    this.props.onChange(column.key, { editable: !column.editable });
  };

  render() {
    const { column, connectDragPreview, connectDragSource } = this.props;
    return (
      connectDragPreview(
        connectDragSource(
          <div className="item-label">
            <div>
              <span className={COLUMNS_ICON_CONFIG[column.type]}></span>
              <span className="label-name ml-2">{column.name}</span>
            </div>
            <span className="dtable-font dtable-icon-add-table" onClick={this.onClick}></span>
          </div>
        )
      )
    );
  }
}

FormSettingColumnItem.propTypes = {
  column: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  connectDragSource: PropTypes.func,
  connectDragPreview: PropTypes.func,
};

export default DragSource('DtableFormElements', dragSource, dragCollect)(FormSettingColumnItem);
