import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { FormGroup, Label, Input } from 'reactstrap';
import isHotkey from 'is-hotkey';

const gettext = window.gettext;

class FormGroupInputSettings extends Component {

  constructor(props) {
    super(props);
    this.state = {
      value: props.value || '',
    };
    this.inputRef = null;
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const nextValue = nextProps.value || '';
    if (nextValue !== this.state.value) {
      this.setState({ value: nextValue });
    }
  }

  onValueChange = (event) => {
    this.setState({ value: event.target.value });
  };

  onKeyDown = (event) => {
    if (this.props.type === 'text') {
      if (isHotkey('enter', event)) {
        this.inputRef && this.inputRef.blur();
      }
    }
  };

  onUpdateValue = () => {
    const { value } = this.state;
    const { value: oldValue, enableEmpty } = this.props;
    const validValue = value ? value.trim() : '';
    if (!validValue && !enableEmpty) {
      this.setState({ value: oldValue });
      return;
    }
    if (validValue === oldValue) return;
    this.props.onValueChange(validValue);
  };

  render() {
    const { className, title, children, type } = this.props;
    const { value } = this.state;

    return (
      <FormGroup key="form-group-input-settings" className={`setting-item table-setting ${className || ''}`} >
        <Label>{title || gettext('Title')}</Label>
        <Input
          type={type}
          innerRef={input => this.newInput = input}
          className="workflow-name-input workflow-form-group-input"
          value={value}
          onChange={this.onValueChange}
          onKeyDown={this.onKeyDown}
          onBlur={this.onUpdateValue}
        />
        {children}
      </FormGroup>
    );
  }
}

FormGroupInputSettings.defaultProps = {
  type: 'text',
  enableEmpty: false,
};

FormGroupInputSettings.propTypes = {
  enableEmpty: PropTypes.bool,
  value: PropTypes.string,
  title: PropTypes.string,
  className: PropTypes.string,
  type: PropTypes.string,
  children: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  onValueChange: PropTypes.func.isRequired,
};

export default FormGroupInputSettings;
