import React from 'react';
import PropTypes from 'prop-types';
import FormCheckboxEditor from '../../../../components-form/cell-editor/checkbox-editor';
import classNames from 'classnames';
import Icon from '../../../../components/icon-universal';
import { DEFAULT_MARKER_STYLE } from '../../../../constants/dtable-icon';

import './checkbox-editor.css';

const CheckboxEditorPropTypes = {
  isReadOnly: PropTypes.bool,
  mode: PropTypes.string,
  value: PropTypes.bool,
  column: PropTypes.object,
  onCommit: PropTypes.func,
  isEditorShow: PropTypes.bool,
  updateTabIndex: PropTypes.func,
};

class CheckboxEditor extends React.Component {

  onChangeCheckboxValue = () => {
    let { column, onCommit, isReadOnly, updateTabIndex, value } = this.props;
    if (isReadOnly) return;
    updateTabIndex && updateTabIndex();
    const updated = {};
    updated[column.key] = !value;
    onCommit(updated, column);
  };

  render() {
    const { isReadOnly, mode, isEditorShow, column, value } = this.props;
    if (mode === 'form') return <FormCheckboxEditor {...this.props} />;
    let style = {
      cursor: isReadOnly ? 'default' : 'pointer',
    };
    if (isEditorShow) {
      style = Object.assign({}, style, { border: '2px solid #3B88FD' });
    }
    const checkboxStyle = column.data?.checkbox_style || DEFAULT_MARKER_STYLE;
    return (
      <div
        className="workflow-checkbox-editor-container"
      >
        <div
          className={classNames(
            'workflow-checkbox-mark-container',
          )}
          style={style}
          onClick={this.onChangeCheckboxValue}
        >
          {value && <Icon
            symbol={checkboxStyle.type}
            color={checkboxStyle.color}
            className='checkbox-svg workflow-checkbox-check-mark'
          />}
        </div>
      </div>
    );
  }
}

CheckboxEditor.propTypes = CheckboxEditorPropTypes;

export default CheckboxEditor;
