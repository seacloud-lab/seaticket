import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../utils/constants';
import LongTextEditorPreviewAll from '../cell-editor-widgets/long-text-editor-preview-all';
import LongTextView from './long-text-view';

const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  isEditorShow: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  column: PropTypes.object,
  onCommit: PropTypes.func,
};

class MobileLongTextEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    isSubmitting: false,
    value: { text: '', preview: '' }
  };

  constructor(props) {
    super(props);
    this.state = {
      newValue: this.initValue(),
      isShowEditorDialog: props.isEditorShow || false,
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    let { isEditorShow } = this.props;
    if (nextProps.isEditorShow && !isEditorShow) {
      this.setState({ isShowEditorDialog: true });
    }
  }

  initValue = () => {
    const { value } = this.props;
    if (value && typeof value === 'object') return value;
    return {
      text: value ? value : '',
      preview: value ? value.slice(0, 30) : '',
    };
  };

  onCommit = (newValue) => {
    this.setState({ newValue: newValue }, () => {
      this.props.onCommit(newValue);
    });
  };

  onContentClick = () => {
    if (this.props.isReadOnly || this.props.isSubmitting) {
      return;
    }
    this.setState({ isShowEditorDialog: true });
  };

  onCloseEditorDialog = () => {
    this.setState({ isShowEditorDialog: false });
  };

  render() {
    let { newValue, isShowEditorDialog } = this.state;
    return (
      <Fragment>
        {newValue.text && (
          <LongTextEditorPreviewAll
            newValue={newValue}
            onContentClick={this.onContentClick}
          />
        )}
        {!newValue.text && (
          <div className="editor-operation long-text-editor-edit" onClick={this.onContentClick}>{gettext('Edit text')}</div>
        )}
        {isShowEditorDialog &&
          <div className="cell-viewer-mobile-mask">
            <LongTextView
              column={this.props.column}
              value={newValue}
              onCommit={this.onCommit}
              closeEditor={this.onCloseEditorDialog}
            />
          </div>
        }
      </Fragment>
    );
  }
}

MobileLongTextEditor.propTypes = propTypes;

export default MobileLongTextEditor;
