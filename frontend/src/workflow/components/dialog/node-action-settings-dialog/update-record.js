import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { CellType } from 'dtable-utils';
import { gettext } from '../../../../utils/constants';
import { NODE_ACTION_SUPPORT_UPDATE_COLUMN_TYPES } from '../../../constants/node-action';
import OptionUtils from '../../../../utils/option-utils';
import FieldItem from './column-item';
import CommonAddTool from '../../../../components/common-add-tool';

class UpdateRecord extends Component {

  constructor(props) {
    super(props);
    const { columns, workflowConfig, action } = props;
    const { participants_column_key, state_column_key } = workflowConfig;
    const readOnlyColumnKeys = [participants_column_key, state_column_key];
    this.editableColumns = Array.isArray(columns) ? columns
      .filter(column => NODE_ACTION_SUPPORT_UPDATE_COLUMN_TYPES.includes(column.type))
      .filter(column => !readOnlyColumnKeys.includes(column.key)) : [];
    this.editableColumnOptions = OptionUtils.generatorIconColumnOptions(this.editableColumns);
    const { updates } = action;
    const updatesArray = this.getUpdatesArray(updates);
    this.state = {
      updates: updatesArray,
    };
  }

  getUpdatesArray = (updatesObj) => {
    let updates = [];
    for (let columnKey in updatesObj) {
      updates.push({
        key: columnKey,
        value: updatesObj[columnKey]
      });
    }
    return updates.filter(update => this.editableColumns.find(column => column.key === update.key));
  };

  updateAction = (update) => {
    this.setState(update, () => {
      const { updates } = this.state;
      let updateObj = {};
      updates.forEach(update => {
        updateObj[update.key] = update.value;
      });
      const { action } = this.props;
      const newAction = { ...action, updates: updateObj };
      this.props.onUpdateAction(newAction);
    });
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
    const { updates } = this.state;
    const isShowAddTool = updates.length < this.editableColumns.length;

    return (
      <>
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

UpdateRecord.propTypes = {
  action: PropTypes.object,
  columns: PropTypes.array,
  workflowConfig: PropTypes.object,
  workflowRelatedUsers: PropTypes.array,
  currentTableID: PropTypes.string,
  onUpdateAction: PropTypes.func,
};

export default UpdateRecord;
