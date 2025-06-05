import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { LongTextEditorDialog } from '@seafile/seafile-editor';
import { toaster } from 'dtable-ui-component';
import { gettext } from '../../../../utils/constants';
import LongTextEditorPreviewAll from '../../long-text-editor-preview-all';
import ObjectUtils from '../../../../utils/object-utils';
import { isLongTextValueExceedLimit } from '../../../utils/utils';
import { Utils } from '../../../../utils/utils';

const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  isEditorShow: PropTypes.bool,
  isSupportPreview: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  column: PropTypes.object,
  editorUtils: PropTypes.object.isRequired,
  onCommit: PropTypes.func,
  updateTabIndex: PropTypes.func,
};

class LongTextEditorNormal extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    isSubmitting: false,
    isSupportPreview: true,
    value: { text: '', preview: '' }
  };

  constructor(props) {
    super(props);
    this.state = {
      newValue: this.getValue(props.value),
      isShowLongTextEditor: props.isEditorShow || false,
    };
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  onKeyDown = (e) => {
    if (e.keyCode === Utils.keyCodes.enter && this.props.isEditorShow && !this.state.isShowLongTextEditor) {
      e.preventDefault();
      this.setState({ isShowLongTextEditor: true });
    }
  };

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { value: oldValue } = this.state;
    const { value } = nextProps;
    const newValue = this.getValue(value);
    if (ObjectUtils.isObjectChanged(newValue, oldValue)) {
      this.setState({ newValue });
    }
  }

  getValue = (value) => {
    if (!value) return { text: '', preview: '' };
    const valueType = Object.prototype.toString.call(value);
    if (valueType === '[object Object]') return value;
    if (valueType === '[object String]') {
      return {
        text: value,
        preview: '',
      };
    }
    return { text: '', preview: '' };
  };


  onContentClick = () => {
    if (!this.props.isSupportPreview) return;
    this.setState({ isShowLongTextEditor: true }, () => {
      this.updateTabIndex(false);
    });
  };

  isLongTextValueValid = (value) => {
    if (isLongTextValueExceedLimit(value)) {
      const message = gettext('The content of the document has exceeded the limit of 100000 characters, and the content cannot be saved');
      toaster.closeAll();
      toaster.danger(message, { duration: null });
      return false;
    }
    return true;
  };

  onSaveEditorValue = (value) => {
    if (!this.isLongTextValueValid(value)) return;

    this.setState({ newValue: value }, () => {
      this.props.onCommit(value);
    });
  };

  onCloseEditorDialog = (value) => {
    // value has no changed, no need to save
    if (!value) {
      this.setState({ isShowLongTextEditor: false }, () => {
        this.updateTabIndex(true);
      });
      return;
    }
    // value is changed and value is valid
    if (this.isLongTextValueValid(value)) {
      this.onSaveEditorValue(value);
      this.setState({ isShowLongTextEditor: false }, () => {
        this.updateTabIndex(true);
      });
      return;
    }
    // value is invalid
    // nothing todo
  };

  updateTabIndex = (isEditorClose) => {
    if (this.props.updateTabIndex) {
      this.props.updateTabIndex(isEditorClose);
    }
  };

  render() {
    const { column, isEditorShow } = this.props;
    const { isShowLongTextEditor, newValue } = this.state;

    return (
      <Fragment>
        {newValue.text && (
          <LongTextEditorPreviewAll
            newValue={newValue}
            onContentClick={this.onContentClick}
            style={isEditorShow ? { border: '2px solid #3B88FD' } : {}}
          />
        )}
        {!newValue.text && (
          <div className={`editor-operation long-text-editor-edit ${isEditorShow && 'focus'}`}
            aria-label={this.props.isRequired ? gettext('Edit text') + ', ' + gettext('Required') : gettext('Edit text')} tabIndex={0} onClick={this.onContentClick}>
            {gettext('Edit text')}
          </div>
        )}
        {isShowLongTextEditor && (
          <LongTextEditorDialog
            readOnly={this.props.isReadOnly}
            headerName={column.name}
            value={newValue.text}
            editorApi={this.props.editorUtils}
            autoSave={true}
            saveDelay={10 * 1000}
            onSaveEditorValue={this.onSaveEditorValue}
            onCloseEditorDialog={this.onCloseEditorDialog}
          />
        )}
      </Fragment>
    );
  }
}

LongTextEditorNormal.propTypes = propTypes;

export default LongTextEditorNormal;
