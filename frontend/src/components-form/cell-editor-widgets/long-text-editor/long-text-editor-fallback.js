import React from 'react';
import PropTypes from 'prop-types';
import isHotkey from 'is-hotkey';
import { gettext } from '../../../utils/constants';

const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  isEditorShow: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  onCommit: PropTypes.func,
  updateTabIndex: PropTypes.func,
};

class LongTextEditorFallback extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      newValue: props.value && props.value.text ? props.value.text : '',
    };
    this.inputRef = null;
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.isEditorShow !== this.props.isEditorShow) {
      if (!nextProps.isEditorShow && this.props.isEditorShow) {
        this.onBlur();
      } else {
        setTimeout(() => {this.inputRef.focus();});
      }
    }
  }

  handleClick = () => {
    this.updateTabIndex();
  };

  updateTabIndex = () => {
    this.props.updateTabIndex && this.props.updateTabIndex(true);
  };

  onChange = (e) => {
    let value = e.target.value;
    if (value !== this.state.newValue) {
      this.setState({ newValue: value });
    }
  };

  onBlur = () => {
    this.props.onCommit(this.state.newValue);
  };

  onKeyDown = (e) => {
    let { selectionStart, selectionEnd, value } = e.currentTarget;
    if (isHotkey('enter', e)) {
      e.preventDefault();
      this.inputRef.blur();
    } else if ((e.keyCode === 37 && selectionStart === 0) ||
      (e.keyCode === 39 && selectionEnd === value.length)
    ) {
      e.stopPropagation();
    }
  };

  onPaste = (e) => {
    e.stopPropagation();
  };

  onCut = (e) => {
    e.stopPropagation();
  };

  render() {
    if (this.props.isReadOnly) {
      return (
        <div className="editor-operation long-text-editor-edit" aria-label={this.props.isRequired ? gettext('Edit text') + ', ' + gettext('Required') : gettext('Edit text') } tabIndex={0} >
          {gettext('Edit text')}
        </div>
      );
    }
    return (
      <textarea
        className="form-control long-text-editor-fallback"
        rows={5}
        value={this.state.newValue || ''}
        onClick={this.handleClick}
        onChange={this.onChange}
        onBlur={this.onBlur}
        onKeyDown={this.onKeyDown}
        onPaste={this.onPaste}
        onCut={this.onCut}
        readOnly={this.props.isSubmitting}
        ref={ref => this.inputRef = ref}
      />
    );
  }
}

LongTextEditorFallback.propTypes = propTypes;

export default LongTextEditorFallback;
