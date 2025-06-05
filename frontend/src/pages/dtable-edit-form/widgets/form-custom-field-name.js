import React, { Component } from 'react';
import { Input, UncontrolledTooltip } from 'reactstrap';
import PropTypes from 'prop-types';
import { Utils } from '../../../utils/utils';

const gettext = window.gettext;

class FormCustomFieldName extends Component {

  static propTypes = {
    column: PropTypes.object.isRequired,
    onColumnChanged: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    const { column } = props;
    this.state = {
      customName: column.custom_name || ''
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.column.custom_name !== this.props.column.custom_name) {
      this.setState({ customName: nextProps.column.custom_name || '' });
    }
  }

  onChange = (e) => {
    const value = e.target.value;
    this.setState({ customName: value });
  };

  onKeyDown = (e) => {
    if (e.keyCode === Utils.keyCodes.enter) {
      e.preventDefault();
      this.onCommit();
      this.inputRef.blur();
    }
  };

  onCommit = () => {
    const { column } = this.props;
    let { customName } = this.state;
    customName = customName.trim();
    if (column.customName === customName) return;
    this.props.onColumnChanged(column.key, { custom_name: customName });
  };

  render() {
    const { customName } = this.state;
    return (
      <div className="form-filed-setting-item filed-setting-item">
        <div className='form-filed-label d-flex align-items-center'>
          {gettext('Name shown in form')}
          <div className="filters-tips ml-1">
            <i className="dtable-font dtable-icon-use-help" id="custom-field-name-tip"></i>
            <UncontrolledTooltip
              target='custom-field-name-tip'
              placement="top"
              innerClassName="form-edit-tooltip-inner"
            >
              {gettext('Set an alternative name for this field, such as a name more meaningful to the person filling out the form. If left blank, the field\'s original name is displayed in the form.')}
            </UncontrolledTooltip>
          </div>
        </div>
        <Input
          className="form-control filed-value"
          value={customName}
          onChange={this.onChange}
          onBlur={this.onCommit}
          onKeyDown={this.onKeyDown}
          innerRef={ref => this.inputRef = ref}
        />
      </div>
    );
  }
}

export default FormCustomFieldName;
