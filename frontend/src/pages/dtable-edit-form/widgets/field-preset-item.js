import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { CellType } from 'dtable-utils';
import { DTableCustomizeSelect } from 'dtable-ui-component';
import { FORM_SUPPORT_PRESET_TYPE } from '../../../constants/form-constants';
import FormEditorGenerator from '../../../components-form/form-editor-generator';
import FilterItemUtils from '../../dtable/dialog/dataset-widgets/filters-widgets/filter-item-utils';
import RateItem from '../../../components-form/cell-formatter-widgets/rate-item';
import { convertRowDataBack } from '../../../utils/utils';

const gettext = window.gettext;

const PERMISSIONS = [
  { name: gettext('Read-Only'), value: 'r' },
  { name: gettext('Read-Write'), value: 'rw' },
  { name: gettext('Invisible'), value: 'hidden' }
];

const propTypes = {
  columns: PropTypes.array,
  existedColumnKeys: PropTypes.array,
  fieldItem: PropTypes.object,
  onDeleteFieldItem: PropTypes.func,
  onUpdateFieldItem: PropTypes.func
};

class FieldPresetItem extends Component {

  constructor(props) {
    super(props);
    const { fieldItem } = props;
    const { column_key: activeColumnKey, value, permission } = fieldItem;
    this.state = {
      activeColumnKey,
      value,
      permission,
      enterRateItemIndex: 0,
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const newValue = nextProps.fieldItem.value;
    if (this.state.value !== newValue) {
      this.setState({ value: newValue });
    }
  }

  onMouseEnterRateItem = (index) => {
    this.setState({ enterRateItemIndex: index });
  };

  onMouseLeaveRateItem = () => {
    this.setState({ enterRateItemIndex: 0 });
  };

  getColumnOptions = () => {
    const { columns } = this.props;
    return columns.filter(column => FORM_SUPPORT_PRESET_TYPE.includes(column.type)).map(column =>
      FilterItemUtils.generatorColumnOption(column)
    );
  };

  getPermissionOptions = () => {
    return PERMISSIONS.map(permission => {
      return {
        value: permission.value,
        label: <span className='select-option-name'>{permission.name}</span>
      };
    });
  };

  getMultipleSelectOptions = (option) => {
    const { value } = this.state;
    return {
      value: { columnOption: option },
      label: (
        <div className='select-option-name multiple-option-name'>
          <div className="multiple-select-option" style={{ background: option.color, color: option.textColor }} title={option.name} aria-label={option.name}>{option.name}</div>
          <div className='multiple-check-icon'>
            {value.indexOf(option.name) > -1 && <i className="option-edit dtable-font dtable-icon-check-mark"></i>}
          </div>
        </div>
      )
    };
  };

  getActiveColumn = () => {
    const { columns } = this.props;
    const { activeColumnKey } = this.state;
    let activeColumn = null;
    let activeColumnOption = null;
    if (activeColumnKey) {
      activeColumn = columns.find(column => column.key === activeColumnKey);
      activeColumnOption = FilterItemUtils.generatorColumnOption(activeColumn);
    }
    return { activeColumn, activeColumnOption };
  };

  setActiveColumn = (value) => {
    const { column } = value;
    const { fieldItem } = this.props;
    const { activeColumnKey } = this.state;
    if (column.key === activeColumnKey) return;
    const newValue = '';
    this.setState({ activeColumnKey: column.key, value: newValue }, () => {
      const update = { column_key: column.key, value: newValue };
      this.props.onUpdateFieldItem(fieldItem.key, update);
    });
  };

  setFieldPermission = (value) => {
    const { fieldItem } = this.props;
    const { permission } = this.state;
    if (permission === value) return;
    this.setState({ permission: value }, () => {
      const update = { permission: value };
      this.props.onUpdateFieldItem(fieldItem.key, update);
    });
  };

  deleteField = () => {
    const { fieldItem } = this.props;
    this.props.onDeleteFieldItem(fieldItem.key);
  };

  onChangeValue = (update) => {
    const { fieldItem } = this.props;
    const { value } = this.state;
    const { activeColumn } = this.getActiveColumn();
    const result = convertRowDataBack([activeColumn], update);
    const newValue = result[activeColumn.key];
    if (value !== newValue) {
      this.setState({ value: newValue }, () => {
        const newUpdate = { value: newValue };
        this.props.onUpdateFieldItem(fieldItem.key, newUpdate);
      });
    }
  };

  onSelectSingle = (selectValue) => {
    const { fieldItem } = this.props;
    const { value } = this.state;
    const { columnOption: option } = selectValue;
    const newValue = option.name;
    if (value === newValue) {
      return;
    }
    this.setState({ value: newValue }, () => {
      const update = { value: newValue };
      this.props.onUpdateFieldItem(fieldItem.key, update);
    });
  };

  onSelectMultiple = (selectValue) => {
    const { fieldItem } = this.props;
    const { columnOption: option } = selectValue;
    let newValue = Array.isArray(this.state.value) ? this.state.value : [];
    let index = newValue.indexOf(option.name);
    if (index > -1) {
      newValue.splice(index, 1);
    } else {
      newValue.push(option.name);
    }
    this.setState({ value: newValue }, () => {
      const update = { value: newValue };
      this.props.onUpdateFieldItem(fieldItem.key, update);
    });
  };

  onChangeRateNumber = (newValue) => {
    const { value } = this.state;
    const { fieldItem } = this.props;
    if (value === newValue) return;
    this.setState({ value: newValue }, () => {
      const update = { value: newValue };
      this.props.onUpdateFieldItem(fieldItem.key, update);
    });
  };

  renderSingleSelectOption = () => {
    const { activeColumn } = this.getActiveColumn();
    const { value } = this.state;
    let { options = [] } = activeColumn.data || {};
    let selectedOption = options.find(option => option.name === value);
    let selectedOptionName = {};
    if (selectedOption) {
      const className = 'select-option-name single-select-option';
      const style = { background: selectedOption.color, color: selectedOption.textColor || null };
      selectedOptionName = {
        label: <span className={className} style={style} title={selectedOption.name} aria-label={selectedOption.name}>{selectedOption.name}</span>
      };
    }

    let dataOptions = options.map(option => {
      return FilterItemUtils.generatorSingleSelectOption(option);
    });
    return (
      <DTableCustomizeSelect
        className="selector-single-select"
        value={selectedOptionName}
        options={dataOptions}
        onSelectOption={this.onSelectSingle}
        placeholder={gettext('Select an option')}
        searchable={true}
        searchPlaceholder={gettext('Search option')}
        noOptionsPlaceholder={gettext('No options available')}
      />
    );
  };

  renderMultipleSelectOption = () => {
    const { activeColumn } = this.getActiveColumn();
    const { value } = this.state;
    let { options = [] } = activeColumn.data || {};
    const className = 'select-option-name multiple-select-option';
    let labelArray = [];
    if (Array.isArray(options) && Array.isArray(value)) {
      value.forEach((item) => {
        let inOption = options.find(option => option.name === item);
        if (inOption) {
          let optionStyle = {
            margin: '0 10px 0 0',
            background: inOption.color,
            color: inOption.textColor || null,
          };
          labelArray.push(
            <span className={className} style={optionStyle} key={'option_' + item} title={inOption.name} aria-label={inOption.name}>
              {inOption.name}
            </span>
          );
        }
      });
    }
    const selectedOptionNames = labelArray.length > 0 ? { label: (<Fragment>{labelArray}</Fragment>) } : {};
    const dataOptions = options.map(option => {
      return this.getMultipleSelectOptions(option);
    });
    return (
      <DTableCustomizeSelect
        className="selector-multiple-select"
        value={selectedOptionNames}
        options={dataOptions}
        onSelectOption={this.onSelectMultiple}
        placeholder={gettext('Select option(s)')}
        searchable={true}
        searchPlaceholder={gettext('Search option')}
        noOptionsPlaceholder={gettext('No options available')}
        supportMultipleSelect={true}
      />
    );
  };

  renderRateOption = () => {
    const { value, enterRateItemIndex } = this.state;
    const { activeColumn } = this.getActiveColumn();
    let { rate_max_number } = activeColumn.data || {};
    let rateList = [];
    for (let i = 0; i < rate_max_number; i++) {
      let rateItem = (
        <RateItem
          key={i}
          enterRateItemIndex={enterRateItemIndex}
          rateItemIndex={i + 1}
          onMouseEnterRateItem={this.onMouseEnterRateItem}
          onMouseLeaveRateItem={this.onMouseLeaveRateItem}
          value={Number(value) || 0}
          column={activeColumn}
          isShowRateItem={true}
          onChangeRateNumber={this.onChangeRateNumber}
          editable={true}
        />
      );
      rateList.push(rateItem);
    }
    return (
      <div className="preset-rate-list custom-select">
        {rateList}
      </div>
    );
  };

  renderPresetValue = () => {
    const { activeColumn } = this.getActiveColumn();
    if (!activeColumn) return <DTableCustomizeSelect isLocked={true} />;
    let { value } = this.state;
    const { type } = activeColumn;
    if (type === CellType.CHECKBOX && value) {
      value = JSON.parse(value);
    }
    if (type === CellType.SINGLE_SELECT) {
      return this.renderSingleSelectOption();
    } else if (type === CellType.MULTIPLE_SELECT) {
      return this.renderMultipleSelectOption();
    } else if (type === CellType.RATE) {
      return this.renderRateOption();
    } else {
      return (
        <FormEditorGenerator
          columns={this.props.columns}
          column={activeColumn}
          onCommit={this.onChangeValue}
          value={value}
          isEditFormPage={true}
        />
      );
    }
  };

  render() {
    const { permission } = this.state;
    const { activeColumnOption } = this.getActiveColumn();
    const columnOptions = this.getColumnOptions();
    const permissionOptions = this.getPermissionOptions();
    const selectedPermission = permissionOptions.find(option => option.value === permission);

    return (
      <div className="field-preset-item mt-2 d-flex align-items-center">
        <div className="delete-field" onClick={this.deleteField}>
          <i className="dtable-font dtable-icon-fork-number"></i>
        </div>
        <div className="preset-item-container ml-3 d-flex align-items-center w-100">
          <div className="preset-column flex-grow-1">
            <DTableCustomizeSelect
              isInModal={true}
              value={activeColumnOption}
              options={columnOptions}
              onSelectOption={this.setActiveColumn}
            />
          </div>
          <span className="dtable-font dtable-icon-insert-right px-md-2" />
          <div className="preset-value">
            {this.renderPresetValue()}
          </div>
          <div className="preset-permission ml-3">
            <DTableCustomizeSelect
              isInModal={true}
              value={selectedPermission}
              options={permissionOptions}
              onSelectOption={this.setFieldPermission}
            />
          </div>
        </div>
      </div>
    );
  }
}

FieldPresetItem.propTypes = propTypes;

export default FieldPresetItem;
