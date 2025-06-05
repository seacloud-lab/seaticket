import React from 'react';
import PropTypes from 'prop-types';
import { Label, FormGroup } from 'reactstrap';
import { CellType } from 'dtable-utils';
import { DTableCustomizeSelect } from 'dtable-ui-component';
import { INIT_NODES } from '../../constants';

const gettext = window.gettext;

class TableSetting extends React.Component {

  onSettingUpdate = (table = {}) => {
    const { workflowConfig } = this.props;
    const { columns, _id: tableId } = table;
    if (tableId === workflowConfig.table_id) return;
    const firstSingleSelectColumn = columns.find(column => column.type === CellType.SINGLE_SELECT) || {};
    const firstCollaboratorColumn = columns.find(column => column.type === CellType.COLLABORATOR) || {};
    this.props.onSettingUpdate({
      table_id: tableId,
      // view_name: views[0].name,
      state_column_key: firstSingleSelectColumn.key || '',
      participants_column_key: firstCollaboratorColumn.key || '',
      nodes: INIT_NODES // setNode
    }, 'table');
  };

  renderSelector = () => {
    const { workflowConfig, tables, isLocked } = this.props;
    const options = tables.map((table) => {
      const value = table;
      const label = table['name'];
      const _id = table['_id'];
      return { value, label, _id };
    });
    let selectedOption = options.find(item => item._id === workflowConfig.table_id);
    if (!selectedOption) {
      selectedOption = options[0];
    }
    return (
      <DTableCustomizeSelect
        className="workflow-select-table"
        isLocked={isLocked}
        value={selectedOption}
        options={options}
        onSelectOption={this.onSettingUpdate}
      />
    );
  };

  render() {
    const { className, title } = this.props;

    return (
      <FormGroup key="page-table" className={`setting-item table-setting settings-select-table ${className}`} >
        <Label>{title || gettext('Table')}</Label>
        <div className="workflow-state-field-tip mb-2">
          {gettext('This is used to record tasks in the workflow.')}
        </div>
        {this.renderSelector()}
      </FormGroup>
    );
  }
}

TableSetting.propTypes = {
  isLocked: PropTypes.bool,
  className: PropTypes.string,
  title: PropTypes.string,
  workflowConfig: PropTypes.object.isRequired,
  tables: PropTypes.array.isRequired,
  onSettingUpdate: PropTypes.func.isRequired,
};

TableSetting.defaultProps = {
  isLocked: false,
  className: '',
  title: gettext('Table'),
};

export default TableSetting;
