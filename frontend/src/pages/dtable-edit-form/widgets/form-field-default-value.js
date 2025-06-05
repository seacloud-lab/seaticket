import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { CellType, formatStringToNumber } from 'dtable-utils';
import { DTableSwitch } from 'dtable-ui-component';
import DateDefaultValue from '../../../components-form/cell-editor-widgets/date-default-value';
import FormEditorGenerator from '../../../components-form/form-editor-generator';

const gettext = window.gettext;

class FormFieldDefaultValue extends Component {

  onUpdateDefaultValue = (update) => {
    const { column } = this.props;
    const { key, type, data } = column;
    const value = update[key];
    if (type === CellType.NUMBER) {
      const default_value = formatStringToNumber(value, data);
      this.props.onColumnChanged(key, { default_value });
      return;
    }
    this.props.onColumnChanged(key, { default_value: value });
  };

  onUpdateSetDefaultValue = () => {
    const { column } = this.props;
    const enable_fill_default_value = !column['enable_fill_default_value'];
    this.props.onColumnChanged(column.key, { enable_fill_default_value });
    if (!enable_fill_default_value) {
      this.props.onColumnChanged(column.key, { default_value: '', enable_fill_default_value });
    }
  };

  onUpdateDefaultValueControl = () => {
    const { column } = this.props;
    const enable_not_change_default_value = !column['enable_not_change_default_value'];
    this.props.onColumnChanged(column.key, { enable_not_change_default_value });
  };

  renderDefaultValueContent = () => {
    const { column, table, tables, columns, apiUploadLinkName } = this.props;
    const { default_value, enable_not_change_default_value } = column;
    const currentColumn = columns.find(item => item.key === column.key);
    const columnType = currentColumn.type;

    if (columnType === CellType.DATE) {
      return (
        <DateDefaultValue
          key={currentColumn.key}
          column={column}
          columns={columns}
          onCommit={this.onUpdateDefaultValue}
          onColumnChanged={this.props.onColumnChanged}
        />
      );
    }
    return (
      <div className="default-value-wrapper">
        <FormEditorGenerator
          isReadOnly={enable_not_change_default_value}
          isSubmitting={enable_not_change_default_value}
          apiUploadLinkName={apiUploadLinkName}
          table={table}
          tables={tables}
          column={column}
          value={default_value}
          row={{}}
          columns={columns}
          onCommit={this.onUpdateDefaultValue}
          isEditFormPage={true}
        />
      </div>
    );
  };

  render() {
    const {
      type,
      enable_fill_default_value: enableFillDefaultValue,
      enable_not_change_default_value: enableNotChangeDefaultValue,
    } = this.props.column;

    return (
      <div className="form-filed-setting-item filed-setting-item default-value">
        <DTableSwitch
          switchClassName={'form-filed-switch flex-reverse'}
          placeholder={gettext('Set default value')}
          checked={enableFillDefaultValue || false}
          onChange={this.onUpdateSetDefaultValue}
        />
        {enableFillDefaultValue &&
          <>
            <div className="form-filed-label mt-2">{gettext('Default value')}</div>
            {this.renderDefaultValueContent()}
            {type === CellType.TEXT &&
              <div className="default-text-tip">
                {gettext('Use {creator.name} or {creator.id} to fill with submitter\'s name or ID if the submitter is a registered user')}
              </div>
            }
            <div className="default-value-switch mt-4">
              <DTableSwitch
                switchClassName={'form-filed-switch flex-reverse'}
                placeholder={gettext('After setting the default value the default value can not be changed')}
                checked={enableNotChangeDefaultValue || false}
                onChange={this.onUpdateDefaultValueControl}
              />
            </div>
          </>
        }
      </div>
    );
  }
}

FormFieldDefaultValue.propTypes = {
  apiUploadLinkName: PropTypes.string,
  column: PropTypes.object,
  table: PropTypes.object,
  columns: PropTypes.array,
  tables: PropTypes.array,
  onColumnChanged: PropTypes.func,
};

export default FormFieldDefaultValue;
