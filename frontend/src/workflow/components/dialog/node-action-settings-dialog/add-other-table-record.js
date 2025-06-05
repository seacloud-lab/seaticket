import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { CellType } from 'dtable-utils';
import { Label } from 'reactstrap';
import { gettext } from '../../../../utils/constants';
import { NODE_ACTION_SUPPORT_UPDATE_COLUMN_TYPES } from '../../../constants/node-action';
import OptionUtils from '../../../../utils/option-utils';
import FieldItem from './column-item';
import CommonAddTool from '../../../../components/common-add-tool';
import { DTableSelect } from 'dtable-ui-component';

class AddOtherTableRecord extends Component {

  constructor(props) {
    super(props);
    const { tables, action } = props;
    const { row = {}, dst_table_id = '' } = action;
    this.tableOptions = tables.map(table => {
      return OptionUtils.generatorKeyLabelOption({ key: table._id, name: table.name });
    });
    const selectedTable = tables.find(table => table._id === dst_table_id) || {};
    const columns = selectedTable.columns || [];
    this.initColumns(columns);
    const updatesArray = this.getUpdatesArray(row);
    this.state = {
      updates: updatesArray,
      selectedTableOption: this.tableOptions.find(table => table.value === dst_table_id),
    };
  }

  initColumns = (columns) => {
    this.editableColumns = Array.isArray(columns) ? columns
      .filter(column => NODE_ACTION_SUPPORT_UPDATE_COLUMN_TYPES.includes(column.type)) : [];
    this.editableColumnOptions = OptionUtils.generatorIconColumnOptions(this.editableColumns);
  };

  getUpdatesArray = (row) => {
    let updates = [];
    for (let columnKey in row) {
      updates.push({
        key: columnKey,
        value: row[columnKey]
      });
    }
    return updates.filter(update => this.editableColumns.find(column => column.key === update.key));
  };

  updateAction = (update) => {
    this.setState(update, () => {
      const { updates, selectedTableOption } = this.state;
      let row = {};
      updates.forEach(update => {
        row[update.key] = update.value;
      });
      const { action } = this.props;
      const newAction = { ...action, row, dst_table_id: selectedTableOption ? selectedTableOption.value : '' };
      this.props.onUpdateAction(newAction);
    });
  };

  onSelectTable = (selectedTableOption) => {
    const selectedTableOptionKey = selectedTableOption.value;
    if (this.state.selectedTableOption && selectedTableOptionKey === this.state.selectedTableOption.value) return;
    const { tables } = this.props;
    const selectTable = tables.find(table => table._id === selectedTableOptionKey) || {};
    const columns = selectTable.columns || [];
    this.initColumns(columns);
    const update = { selectedTableOption, updates: [] };
    this.updateAction(update);
  };

  onAddColumn = () => {
    const { updates } = this.state;
    const columns = this.editableColumns.filter(column => !updates.find(item => item.key === column.key));
    const firstColumn = columns[0];
    const newUpdates = updates.slice(0, );
    const { key, type } = firstColumn;
    const value = type === CellType.DATE ? { value: '', set_type: 'specific_value' } : '';
    newUpdates.push({
      key,
      value
    });
    this.updateAction({ updates: newUpdates });
  };

  onDeleteColumn = (columnIndex) => {
    const { updates } = this.state;
    let newUpdates = updates.slice(0, );
    newUpdates.splice(columnIndex, 1);
    this.updateAction({ updates: newUpdates });
  };

  onUpdateColumn = (columnIndex, newColumn) => {
    const { updates } = this.state;
    let newUpdates = updates.slice(0, );
    newUpdates.splice(columnIndex, 1, newColumn);
    this.updateAction({ updates: newUpdates });
  };

  renderActionFields = () => {
    const { currentTableID, workflowRelatedUsers } = this.props;
    const { updates } = this.state;
    return updates.map((update, index) => {
      const { key, value } = update;
      const column = this.editableColumns.find(item => item.key === key);
      if (!column) return null;
      return (
        <FieldItem
          key={key}
          column={column}
          cellValue={value}
          index={index}
          updates={updates}
          columns={this.editableColumns}
          columnOptions={this.editableColumnOptions}
          currentTableID={currentTableID}
          workflowRelatedUsers={workflowRelatedUsers}
          onDeleteColumn={this.onDeleteColumn}
          onUpdateColumn={this.onUpdateColumn}
        />
      );
    });
  };

  render() {
    const { updates, selectedTableOption } = this.state;
    const isShowAddTool = updates.length < this.editableColumns.length;

    return (
      <>
        <div className="workflow-node-update-record-action-tables">
          <Label className="item-label">{gettext('Tables')}</Label>
          <DTableSelect
            options={this.tableOptions}
            value={selectedTableOption}
            onChange={this.onSelectTable}
            placeholder={gettext('Select table')}
            menuPortalTarget={'.workflow-node-action-settings-modal'}
            noOptionsMessage={() => {
              return <span>{gettext('No table')}</span>;
            }}
          />
        </div>
        <div className="workflow-node-update-record-action-fields">
          {this.renderActionFields()}
        </div>
        {isShowAddTool && (
          <CommonAddTool
            className="workflow-node-action-add-update-record-field"
            footerName={gettext('Add field')}
            callBack={this.onAddColumn}
          />
        )}
      </>
    );
  }
}

AddOtherTableRecord.propTypes = {
  action: PropTypes.object,
  tables: PropTypes.array,
  workflowRelatedUsers: PropTypes.array,
  currentTableID: PropTypes.string,
  onUpdateAction: PropTypes.func,
};

export default AddOtherTableRecord;
