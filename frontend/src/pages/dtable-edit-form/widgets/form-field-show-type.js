import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { FormGroup } from 'reactstrap';
import { DTableRadio } from 'dtable-ui-component';
import { OPTIONS_SHOW_TYPE } from '../../../constants/form-constants';

const gettext = window.gettext;

class FromFieldShowType extends Component {

  static propTypes = {
    column: PropTypes.object.isRequired,
    onColumnChanged: PropTypes.func.isRequired,
  };

  onShowOptionsTypeChange = (type) => {
    return () => {
      const { column } = this.props;
      this.props.onColumnChanged(column.key, { options_show_type: type });
    };
  };

  render() {
    const { column } = this.props;
    const { options_show_type } = column;
    const isList = options_show_type === OPTIONS_SHOW_TYPE.LIST;
    return (
      <div className="form-filed-setting-item shown-type">
        <div className="form-filed-label">{gettext('Display mode')}</div>
        <div className="type-options">
          <FormGroup check className={`show-type-item ${!isList ? 'type-selected' : ''}`}>
            <DTableRadio
              name="show-type"
              label={gettext('Dropdown')}
              isChecked={!isList}
              onCheckedChange={this.onShowOptionsTypeChange(OPTIONS_SHOW_TYPE.DROPDOWN)}
            />
          </FormGroup>
          <FormGroup check className={`show-type-item ${isList ? 'type-selected' : ''}`}>
            <DTableRadio
              name="show-type"
              label={gettext('List')}
              isChecked={isList}
              onCheckedChange={this.onShowOptionsTypeChange(OPTIONS_SHOW_TYPE.LIST)}
            />
          </FormGroup>
        </div>
      </div>
    );
  }
}

export default FromFieldShowType;
