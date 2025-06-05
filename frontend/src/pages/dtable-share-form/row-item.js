import React from 'react';
import PropTypes from 'prop-types';
import FormLabel from '../../components-form/form-label';
import FormEditorGenerator from '../../components-form/form-editor-generator';
import LongTextEditorPreviewAll from '../../components-form/cell-editor-widgets/long-text-editor-preview-all';
import { FORM_REMARK_DEFAULT_TEXT_COLOR } from '../../constants/form-constants';

const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  formColumnDescriptionColor: PropTypes.string,
  column: PropTypes.object.isRequired,
  editorConfig: PropTypes.object,
  firstEditorKeyPress: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array, PropTypes.object, PropTypes.bool, PropTypes.number]),
  isEditorShow: PropTypes.bool,
  row: PropTypes.object,
  columns: PropTypes.array,
  onCommit: PropTypes.func,
  setScrollTop: PropTypes.func,
  updateTabIndex: PropTypes.func,
  getHistoryCommitByColumnKey: PropTypes.func,
};

class RowItem extends React.Component {

  static defaultProps = {
    isReadOnly: false,
  };

  onCommit = (updated) => {
    let { onCommit } = this.props;
    if (onCommit) {
      onCommit(updated);
    }
  };

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.isEditorShow) {
      this.props.setScrollTop(this.rowItem.offsetTop);
    }
  }

  setRowRef = (rowItem) => {
    this.rowItem = rowItem;
  };

  render() {
    let { isReadOnly, column, value, isEditorShow, updateTabIndex, getHistoryCommitByColumnKey,
      isSubmitting, row, columns, formColumnDescriptionColor, editorConfig } = this.props;
    const description = column.description;
    const style = { color: formColumnDescriptionColor || FORM_REMARK_DEFAULT_TEXT_COLOR };
    const { require_fill_checked, is_required } = column;
    return (
      <div className="form_mode compose-editor" ref={(rowItem) => {this.setRowRef(rowItem);}}>
        <div className="cell-label-container">
          <FormLabel column={column} />
        </div>
        {description && <LongTextEditorPreviewAll newValue={{ text: description }} style={style} />}
        <FormEditorGenerator
          useInlineEditor={true}
          isReadOnly={isReadOnly}
          isSubmitting={isSubmitting}
          value={value}
          column={column}
          onCommit={this.onCommit}
          isEditorShow={isEditorShow}
          updateTabIndex={updateTabIndex}
          getHistoryCommitByColumnKey={getHistoryCommitByColumnKey}
          row={row}
          columns={columns}
          editorConfig={editorConfig}
          isEditFormPage={false}
          isRequired={require_fill_checked || is_required}
        />
      </div>
    );
  }
}

RowItem.propTypes = propTypes;

export default RowItem;
