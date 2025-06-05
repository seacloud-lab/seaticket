import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DATE_DEFAULT_TYPES } from 'dtable-utils';
import { DATE_COLUMN_DEFAULT_OPTIONS } from '../../constants/form-constants';
import { DTableSelect } from 'dtable-ui-component';
import FormEditorGenerator from '../../components-form/form-editor-generator';

const gettext = window.gettext;

const propTypes = {
  column: PropTypes.object,
  row: PropTypes.object,
  currentColumns: PropTypes.array,
  onCommit: PropTypes.func,
  onColumnChanged: PropTypes.func,
};

class DateDefaultValue extends Component {

  constructor(props) {
    super(props);
    const { column } = props;
    const { default_value: defaultValue } = column;
    const dateType = defaultValue === DATE_DEFAULT_TYPES.CURRENT_DATE ? DATE_DEFAULT_TYPES.CURRENT_DATE :
      DATE_DEFAULT_TYPES.SPECIFIC_DATE;
    this.state = {
      dateType
    };
    this.defaultTypeOptions = this.createDefaultTypeOptions();
  }

  createDefaultTypeOptions = () => {
    return DATE_COLUMN_DEFAULT_OPTIONS.map((defaultTypeOption) => {
      return {
        value: defaultTypeOption.type,
        label: (
          <span className='select-module select-module-name form-date-default-type'>
            {gettext(defaultTypeOption.name)}
          </span>
        )
      };
    });
  };

  onChangeDateDefaultType = (selectedTypeOption) => {
    const { column } = this.props;
    let { enable_not_change_default_value: enableNotChangeDefaultValue } = column;
    const { dateType } = this.state;
    const newDateType = selectedTypeOption.value;
    if (dateType === newDateType || enableNotChangeDefaultValue) return;
    this.setState({ dateType: newDateType }, () => {
      const defaultValue = newDateType === DATE_DEFAULT_TYPES.CURRENT_DATE ? DATE_DEFAULT_TYPES.CURRENT_DATE : null;
      this.props.onColumnChanged(column.key, { default_value: defaultValue });
    });
  };

  render() {
    const { dateType } = this.state;
    const { column, row, currentColumns } = this.props;
    let {
      enable_fill_default_value: enableFillDefaultValue,
      default_value: defaultValue,
      enable_not_change_default_value: enableNotChangeDefaultValue,
    } = column;
    const selectedTypeOption = this.defaultTypeOptions.find(option => option.value === dateType);
    return (
      <div className="date-default-container">
        <div className='date-default-type'>
          <DTableSelect
            options={this.defaultTypeOptions}
            value={selectedTypeOption}
            onChange={this.onChangeDateDefaultType}
            isDisabled={enableNotChangeDefaultValue}
            classNamePrefix={enableNotChangeDefaultValue ? 'disabled-select' : ''}
            menuPortalTarget="#wrapper"
          />
        </div>
        {dateType === DATE_DEFAULT_TYPES.SPECIFIC_DATE &&
          <div className="date-default-value mt-3">
            <FormEditorGenerator
              isReadOnly={enableNotChangeDefaultValue}
              isSubmitting={enableFillDefaultValue && enableNotChangeDefaultValue}
              column={column}
              value={defaultValue}
              row={row || {}}
              columns={currentColumns}
              onCommit={this.props.onCommit}
              isEditFormPage={true}
            />
          </div>
        }
      </div>
    );
  }
}

DateDefaultValue.propTypes = propTypes;

export default DateDefaultValue;
