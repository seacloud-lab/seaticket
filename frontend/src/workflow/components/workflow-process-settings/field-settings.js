import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Input } from 'reactstrap';
import { CellType, getTableById, getLinkedTableID, FILL_DEFAULT_VALUE_COLUMNS_TYPE } from 'dtable-utils';
import CommonSettingsComponent from './common-settings-component';
import IsRequired from '../workflow-edit-form/form-field-settings/is-required';
import HelpText from '../workflow-edit-form/form-field-settings/help-text';
import LinkCondition from '../workflow-edit-form/form-field-settings/link-condition';
import FormFieldShownCondition from '../../../pages/dtable-edit-form/widgets/form-field-shown-condition';
import FromFieldShowType from '../../../pages/dtable-edit-form/widgets/form-field-show-type';
import FormCustomFieldName from '../../../pages/dtable-edit-form/widgets/form-custom-field-name';
import FormFieldDefaultValue from '../../../pages/dtable-edit-form/widgets/form-field-default-value';
import eventBus from '../../../utils/event-bus';
import { EVENT_OPERATION_TYPE } from '../../../constants/event-operation-type';

const gettext = window.gettext;

class FieldSettings extends Component {

  showNodeSettings = () => {
    this.props.showNodeSettings();
    eventBus.dispatch(EVENT_OPERATION_TYPE.UNSELECT_WORKFLOW_FORM_FIELD);
  };

  onColumnChanged = (column_key, update = {}) => {
    const { workflowConfig } = this.props;
    const { columns_config } = workflowConfig;
    const columnsConfig = columns_config || {};
    let newColumnsConfig = { ...columnsConfig };
    const column = newColumnsConfig[column_key] || {};
    let newColumn = { ...column, ...update };
    delete newColumn['link_existed_visible_column_fields'];
    newColumnsConfig[column_key] = newColumn;
    const newWorkflowConfig = { ...workflowConfig, columns_config: newColumnsConfig };
    this.props.updateWorkflowConfig(newWorkflowConfig);
  };

  getLinkedTable = () => {
    const { selectedColumnKey, allColumns } = this.props;
    const selectedColumn = allColumns.find(column => column.key === selectedColumnKey);
    if (selectedColumn.type !== CellType.LINK) return;
    const { workflowConfig, tables } = this.props;
    const { other_table_id, table_id } = selectedColumn.data;
    const currentTableId = workflowConfig.table_id;
    const linkedTableID = getLinkedTableID(currentTableId, table_id, other_table_id);
    const linkedTable = getTableById(tables, linkedTableID);
    return linkedTable;
  };

  renderDefaultValue = () => {
    const { workflowConfig, allColumns, selectedColumnKey, tables } = this.props;
    const selectedColumn = allColumns.find(column => column.key === selectedColumnKey) || {};
    const { table_id } = workflowConfig;
    const { type } = selectedColumn;
    const table = getTableById(tables, table_id);
    if (type === CellType.COLLABORATOR || !FILL_DEFAULT_VALUE_COLUMNS_TYPE.includes(type)) return null;

    return (
      <div className="app-form-settings">
        <FormFieldDefaultValue
          apiUploadLinkName='getUploadLinkViaWorkflowToken'
          column={selectedColumn}
          columns={allColumns}
          table={table}
          tables={tables}
          onColumnChanged={this.onColumnChanged}
        />
        <div className="filed-setting-divider"></div>
      </div>
    );
  };

  render() {
    const { selectedColumnKey, allColumns } = this.props;
    const selectedColumn = allColumns.find(column => column.key === selectedColumnKey) || {};
    const { type } = selectedColumn;

    return (
      <CommonSettingsComponent
        header={(
          <>
            <div
              className="workflow-app-settings-header-return mr-1"
              onClick={this.showNodeSettings}
            >
              <i className="dtable-font dtable-icon-return"></i>
            </div>
            {gettext('Field settings')}
          </>
        )}
      >
        <div className='workflow-app-settings-content'>
          <div className="filed-setting-item is-required">
            <div className='filed-label'>
              <div>{gettext('Field name')}</div>
            </div>
            <Input className="form-control filed-value" value={selectedColumn.name} disabled />
          </div>
          <div className="filed-setting-divider"></div>
          <FormCustomFieldName
            column={selectedColumn}
            onColumnChanged={this.onColumnChanged}
          />
          <div className="filed-setting-divider"></div>
          <HelpText
            column={selectedColumn}
            onColumnChanged={this.onColumnChanged}
          />
          {[CellType.SINGLE_SELECT, CellType.MULTIPLE_SELECT].includes(type) &&
            <>
              <div className="filed-setting-divider"></div>
              <div className="filed-setting-item">
                <FromFieldShowType
                  column={selectedColumn}
                  onColumnChanged={this.onColumnChanged}
                />
              </div>
            </>
          }
          <div className="filed-setting-divider"></div>
          <IsRequired
            column={selectedColumn}
            onColumnChanged={this.onColumnChanged}
          />
          <div className="filed-setting-divider"></div>
          {this.renderDefaultValue()}
          <div className="filed-setting-item">
            <FormFieldShownCondition
              column={selectedColumn}
              columns={allColumns.filter(column => column.key !== selectedColumn.key)}
              onColumnChanged={this.onColumnChanged}
            />
          </div>
          {type === CellType.LINK &&
            <LinkCondition
              column={selectedColumn}
              linkedTable={this.getLinkedTable()}
              onColumnChanged={this.onColumnChanged}
            />
          }
        </div>
      </CommonSettingsComponent>
    );
  }
}

FieldSettings.propTypes = {
  workflowConfig: PropTypes.object,
  tables: PropTypes.array,
  selectedColumnKey: PropTypes.string,
  allColumns: PropTypes.array,
  showNodeSettings: PropTypes.func,
  updateWorkflowConfig: PropTypes.func,
};

export default FieldSettings;
