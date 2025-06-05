import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DTableSwitch } from 'dtable-ui-component';

const gettext = window.gettext;

class FormFieldMustChecked extends Component {

  static propTypes = {
    column: PropTypes.object.isRequired,
    onColumnChanged: PropTypes.func.isRequired,
  };

  onRequiredChanged = () => {
    const { column } = this.props;
    this.props.onColumnChanged(column.key, { require_fill_checked: !column.require_fill_checked });
  };

  render() {
    const { column } = this.props;
    return (
      <div className="form-filed-setting-item">
        <DTableSwitch
          switchClassName='form-filed-switch flex-reverse'
          placeholder={gettext('Required')}
          checked={column.require_fill_checked}
          onChange={this.onRequiredChanged}
        />
      </div>
    );
  }
}

export default FormFieldMustChecked;
