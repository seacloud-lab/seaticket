import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DragSource } from 'react-dnd';
import { FORM_ELEMENTS_TYPE } from '../../../constants/form-constants';

const gettext = window.gettext;

const dragSource = {
  beginDrag: props => {
    return { idx: -1, type: FORM_ELEMENTS_TYPE.REMARKS };
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

class FormSettingStaticNotes extends Component {

  render() {
    const { connectDragPreview, connectDragSource } = this.props;
    return (
      connectDragPreview(
        connectDragSource(
          <div className="item-label">
            <div className="d-flex align-items-center">
              <span className="dtable-font dtable-icon-description"></span>
              <span className="label-name ml-2">{gettext('Notes')}</span>
            </div>
            <span className="dtable-font dtable-icon-add-table" onClick={this.props.onAddNotes}></span>
          </div>
        )
      )
    );
  }
}

FormSettingStaticNotes.propTypes = {
  connectDragSource: PropTypes.func,
  connectDragPreview: PropTypes.func,
  onAddNotes: PropTypes.func,
};

export default DragSource('DtableFormElements', dragSource, dragCollect)(FormSettingStaticNotes);
