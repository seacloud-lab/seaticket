import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Input } from 'reactstrap';
import { CellType, getTableById, FILL_DEFAULT_VALUE_COLUMNS_TYPE } from 'dtable-utils';
import { DTableSwitch } from 'dtable-ui-component';
import FormFieldHelpText from '../widgets/form-field-help-text';
import FromFieldShowType from '../widgets/form-field-show-type';
import FormFieldRequired from '../widgets/form-field-required';
import FormFieldDefaultValue from '../widgets/form-field-default-value';
import FormFieldShownCondition from '../widgets/form-field-shown-condition';
import FormFieldMustChecked from '../widgets/form-field-must-checked';
import { FORM_ELEMENTS_TYPE } from '../../../constants/form-constants';
import FormCustomFieldName from '../widgets/form-custom-field-name';
import AppRemarkSettingsContent from './app-remark-settings-content';

const gettext = window.gettext;

class AppFormElementSettings extends Component {

  onClickReturn = () => {
    this.props.updateSettingElement(null);
  };

  onScanCodeEntryChange = () => {
    const { column } = this.props;
    const { key, enable_scan_code_entry } = column;
    let update = { enable_scan_code_entry: !enable_scan_code_entry };
    this.props.onColumnChanged(key, update);
  };

  renderFieldName = () => {
    const { column } = this.props;
    return (
      <div className="form-filed-setting-item">
        <div className='form-filed-label'>
          <div>{gettext('Field name')}</div>
        </div>
        <Input className="form-control filed-value" value={column.name} disabled={true}/>
      </div>
    );
  };

  renderShowType = () => {
    const { column } = this.props;
    if (![CellType.SINGLE_SELECT, CellType.MULTIPLE_SELECT].includes(column.type)) {
      return null;
    }
    return (
      <>
        <FromFieldShowType column={column} onColumnChanged={this.props.onColumnChanged}/>
        {this.renderDivider()}
      </>
    );
  };

  renderCheckboxModule = () => {
    const { column } = this.props;
    if (CellType.CHECKBOX !== column.type) return null;
    return (
      <>
        <FormFieldMustChecked
          column={column}
          onColumnChanged={this.props.onColumnRequiredChanged}
        />
        {this.renderDivider()}
      </>
    );
  };

  renderDefaultValue = () => {
    const { currentColumns, tables, tableId, column, onColumnChanged } = this.props;
    const table = getTableById(tables, tableId);
    if (!FILL_DEFAULT_VALUE_COLUMNS_TYPE.includes(column.type)) return null;

    return (
      <>
        <FormFieldDefaultValue
          column={column}
          columns={currentColumns}
          table={table}
          tables={tables}
          onColumnChanged={onColumnChanged}
        />
        {this.renderDivider()}
      </>
    );
  };

  renderShownCondition = () => {
    const { column, currentColumns, elementsOrder } = this.props;
    let validMap = new Map();
    elementsOrder.forEach(element => {
      if (element.type === FORM_ELEMENTS_TYPE.COLUMN && element.key !== column.key) {
        validMap.set(element.key, true);
      }
    });
    const validColumns = currentColumns.filter(column => validMap.has(column.key));
    return (
      <FormFieldShownCondition
        column={column}
        columns={validColumns}
        onColumnChanged={this.props.onColumnChanged}
      />
    );
  };

  renderFormFieldRequired = () => {
    const { column, onColumnRequiredChanged } = this.props;
    if (CellType.CHECKBOX === column.type) return null;
    return (
      <>
        <FormFieldRequired column={column} onColumnChanged={onColumnRequiredChanged}/>
        {this.renderDivider()}
      </>
    );
  };

  renderDivider = () => {
    return (
      <div className="table-setting-divider"></div>
    );
  };

  renderScanInput = () => {
    const { column } = this.props;
    if (column.type !== CellType.TEXT) return;
    const { enable_scan_code_entry: enableScanCodeEntry } = column;
    return (
      <>
        <DTableSwitch
          switchClassName={'form-filed-switch flex-reverse'}
          placeholder={gettext('Support input by scanning barcode or QR code')}
          checked={enableScanCodeEntry}
          onChange={this.onScanCodeEntryChange}
        />
        {this.renderDivider()}
      </>
    );
  };

  renderColumnSettingsContent = () => {
    const { column, onColumnChanged } = this.props;
    return (
      <>
        {this.renderFieldName()}
        <FormCustomFieldName column={this.props.column} onColumnChanged={this.props.onColumnChanged} />
        <FormFieldHelpText column={column} onColumnChanged={onColumnChanged} />
        {this.renderDivider()}
        {this.renderCheckboxModule()}
        {this.renderShowType()}
        {this.renderFormFieldRequired()}
        {this.renderScanInput()}
        {this.renderDefaultValue()}
        {this.renderShownCondition()}
      </>
    );
  };

  render() {
    const { settingElement, staticElements } = this.props;
    const title = settingElement.type === FORM_ELEMENTS_TYPE.REMARKS ? gettext('Notes settings') : gettext('Field settings');

    return (
      <div className="app-side-container">
        <div className="app-form-settings">
          <div className="app-form-field-settings-header">
            <div className="field-settings-return mr-1" onClick={this.onClickReturn}>
              <i className="dtable-font dtable-icon-return"></i>
            </div>
            <div className='form-settings-header-tab form-field-settings-tab' title={title}>{title}</div>
          </div>
          <div className="app-form-field-settings-content">
            {settingElement.type === FORM_ELEMENTS_TYPE.REMARKS ?
              <AppRemarkSettingsContent
                settingElement={settingElement}
                staticElements={staticElements}
                onSave={this.props.onSave}
              />
              : this.renderColumnSettingsContent()}
          </div>
        </div>
      </div>
    );
  }
}

AppFormElementSettings.propTypes = {
  tableId: PropTypes.string,
  column: PropTypes.object,
  settingElement: PropTypes.object,
  tables: PropTypes.array,
  currentColumns: PropTypes.array,
  elementsOrder: PropTypes.array,
  staticElements: PropTypes.array,
  onSave: PropTypes.func,
  onColumnChanged: PropTypes.func,
  updateSettingElement: PropTypes.func,
  onColumnRequiredChanged: PropTypes.func,
};

export default AppFormElementSettings;
