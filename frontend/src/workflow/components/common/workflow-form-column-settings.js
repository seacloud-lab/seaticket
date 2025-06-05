import React from 'react';
import PropTypes from 'prop-types';
import { COLUMNS_ICON_CONFIG } from 'dtable-utils';
import { Label, FormGroup } from 'reactstrap';
import { WORKFLOW_SUPPORT_EDIT_TYPE_MAP, WORKFLOW_SUPPORT_VISIBLE_TYPE_MAP } from '../../constants';

const gettext = window.gettext;

class WorkflowFormColumnSettings extends React.Component {

  constructor(props) {
    super(props);
    const allColumns = this.getColumns();
    const { readOnlyColumns, readWriteColumns } = this.getNodeFormColumns(props);
    const { isAllColumnsVisible, isAllColumnsEditable } = this.getAllColumnsState(allColumns, readOnlyColumns, readWriteColumns);
    this.state = {
      isAllColumnsVisible,
      isAllColumnsEditable
    };
  }

  UNSAFE_componentWillReceiveProps(props) {
    const allColumns = this.getColumns();
    const { readOnlyColumns, readWriteColumns } = this.getNodeFormColumns(props);
    const { isAllColumnsVisible, isAllColumnsEditable } = this.getAllColumnsState(allColumns, readOnlyColumns, readWriteColumns);
    this.setState({ isAllColumnsVisible, isAllColumnsEditable });
  }

  getNodeFormColumns = (props) => {
    const { selectedNode } = props;
    const readOnlyColumns = selectedNode.node_form ? selectedNode.node_form.readonly_columns || [] : [];
    const readWriteColumns = selectedNode.node_form ? selectedNode.node_form.readwrite_columns || [] : [];
    return { readOnlyColumns, readWriteColumns };
  };

  getAllColumnsState = (allColumns, readOnlyColumns, readWriteColumns) => {
    let isAllColumnsVisible = true;
    let isAllColumnsEditable = true;
    allColumns.forEach(col => {
      if (isAllColumnsVisible) {
        let currentExist = (!!readOnlyColumns.find(rCol => rCol.key === col.key)) || (!!readWriteColumns.find(rwCol => rwCol.key === col.key));
        if (!currentExist) {
          isAllColumnsVisible = false;
        }
      }
      if (isAllColumnsEditable && WORKFLOW_SUPPORT_EDIT_TYPE_MAP[col.type]) {
        let currentExist = !!readWriteColumns.find(rwCol => rwCol.key === col.key);
        if (!currentExist) {
          isAllColumnsEditable = false;
        }
      }
    });
    return { isAllColumnsVisible, isAllColumnsEditable };
  };

  onChangeColumnVisible = (column_key, checked) => {
    const { selectedNode } = this.props;
    const allColumns = this.getColumns();
    const readOnlyColumns = selectedNode.node_form ? selectedNode.node_form.readonly_columns || [] : [];
    const readWriteColumns = selectedNode.node_form ? selectedNode.node_form.readwrite_columns || [] : [];
    if (checked) {
      readOnlyColumns.push({
        key: column_key
      });
    } else {
      const rIndex = readOnlyColumns.findIndex(col => col.key === column_key);
      const rwIndex = readWriteColumns.findIndex(col => col.key === column_key);
      if (rwIndex !== -1) {
        readWriteColumns.splice(rwIndex, 1);
      }
      if (rIndex !== -1) {
        readOnlyColumns.splice(rIndex, 1);
      }
    }
    const { isAllColumnsVisible, isAllColumnsEditable } = this.getAllColumnsState(allColumns, readOnlyColumns, readWriteColumns);
    this.setState({ isAllColumnsVisible, isAllColumnsEditable }, () => {
      const node_form = Object.assign({}, selectedNode.node_form || {}, {
        readonly_columns: readOnlyColumns,
        readwrite_columns: readWriteColumns
      });
      this.props.changeNode(this.props.selectedNode._id, Object.assign({}, this.props.selectedNode, { node_form: node_form }));
    });
  };

  onChangeColumnEditable = (column_key, checked) => {
    const { selectedNode } = this.props;
    const allColumns = this.getColumns();
    const readOnlyColumns = selectedNode.node_form ? selectedNode.node_form.readonly_columns || [] : [];
    const readWriteColumns = selectedNode.node_form ? selectedNode.node_form.readwrite_columns || [] : [];
    const rIndex = readOnlyColumns.findIndex(col => col.key === column_key);
    const rwIndex = readWriteColumns.findIndex(col => col.key === column_key);
    if (checked) {
      if (rIndex !== -1) {
        readOnlyColumns.splice(rIndex, 1);
      }
      if (rwIndex === -1) {
        readWriteColumns.push({
          key: column_key,
          is_required: false
        });
      }
    } else {
      readWriteColumns.splice(rwIndex, 1);
      if (selectedNode.type !== 'init' && rIndex === -1) {
        readOnlyColumns.push({
          key: column_key
        });
      }
    }
    const { isAllColumnsVisible, isAllColumnsEditable } = this.getAllColumnsState(allColumns, readOnlyColumns, readWriteColumns);
    this.setState({ isAllColumnsVisible, isAllColumnsEditable }, () => {
      const node_form = Object.assign({}, selectedNode.node_form || {}, {
        readonly_columns: readOnlyColumns,
        readwrite_columns: readWriteColumns
      });
      this.props.changeNode(this.props.selectedNode._id, Object.assign({}, this.props.selectedNode, { node_form: node_form }));
    });
  };

  onChangeAllColumnsVisible = () => {
    this.setState({ isAllColumnsVisible: !this.state.isAllColumnsVisible }, () => {
      const { selectedNode } = this.props;
      let { isAllColumnsVisible } = this.state;
      let readOnlyColumns = selectedNode.node_form ? selectedNode.node_form.readonly_columns || [] : [];
      let readWriteColumns = selectedNode.node_form ? selectedNode.node_form.readWrite_columns || [] : [];
      const allColumns = this.getColumns();
      if (!isAllColumnsVisible) {
        readOnlyColumns = [];
        readWriteColumns = [];
      } else {
        allColumns.forEach(column => {
          const rIndex = readOnlyColumns.findIndex(col => col.key === column.key);
          const rwIndex = readWriteColumns.findIndex(col => col.key === column.key);
          if (rwIndex !== -1) {
            return;
          }
          if (rIndex !== -1) {
            return;
          }
          readOnlyColumns.push({
            key: column.key
          });
        });
      }
      const node_form = Object.assign({}, selectedNode.node_form || {}, {
        readonly_columns: readOnlyColumns,
        readwrite_columns: readWriteColumns
      });
      this.props.changeNode(this.props.selectedNode._id, Object.assign({}, this.props.selectedNode, { node_form: node_form }));
    });
  };

  onChangeAllColumnsEditable = () => {
    this.setState({ isAllColumnsEditable: !this.state.isAllColumnsEditable }, () => {
      const { selectedNode } = this.props;
      let { isAllColumnsEditable } = this.state;
      let readOnlyColumns = selectedNode.node_form ? selectedNode.node_form.readonly_columns || [] : [];
      let readWriteColumns = selectedNode.node_form ? selectedNode.node_form.readWrite_columns || [] : [];
      const allColumns = this.getColumns();
      if (!isAllColumnsEditable) {
        if (selectedNode.type !== 'init') {
          readOnlyColumns = allColumns.map(col => {return { key: col.key };});
          readWriteColumns = [];
        } else {
          readOnlyColumns = [];
          readWriteColumns = [];
        }
      } else {
        readWriteColumns = allColumns.filter(col => WORKFLOW_SUPPORT_EDIT_TYPE_MAP[col.type])
          .map(col => {return { key: col.key };});
        readOnlyColumns = [];
      }
      const node_form = Object.assign({}, selectedNode.node_form || {}, {
        readonly_columns: readOnlyColumns,
        readwrite_columns: readWriteColumns
      });
      this.props.changeNode(this.props.selectedNode._id, Object.assign({}, this.props.selectedNode, { node_form: node_form }));
    });
  };

  getColumns = () => {
    const { dtableUtils, workflowConfig } = this.props;
    const state_column_key = workflowConfig.state_column_key || '';
    const participants_column_key = workflowConfig.participants_column_key || '';
    let columns = [];
    dtableUtils.columns.forEach(column => {
      if ([state_column_key, participants_column_key].indexOf(column.key) !== -1) return;
      if (WORKFLOW_SUPPORT_VISIBLE_TYPE_MAP[column.type]) {
        columns.push(column);
      }
    });
    return columns;
  };

  getSelectedColumnMap = () => {
    const { selectedNode } = this.props;
    const readOnlyColumns = selectedNode.node_form ? selectedNode.node_form.readonly_columns || [] : [];
    const readWriteColumns = selectedNode.node_form ? selectedNode.node_form.readwrite_columns || [] : [];
    const readOnlyColumnsMap = {};
    const readWriteColumnsMap = {};
    readOnlyColumns.forEach(col => readOnlyColumnsMap[col.key] = col);
    readWriteColumns.forEach(col => readWriteColumnsMap[col.key] = col);
    return { readOnlyColumnsMap, readWriteColumnsMap };
  };

  render() {
    const columns = this.getColumns();
    const { readOnlyColumnsMap, readWriteColumnsMap } = this.getSelectedColumnMap();
    const { isAllColumnsVisible, isAllColumnsEditable } = this.state;
    const { selectedNode } = this.props;
    const isInitNode = selectedNode.type === 'init';
    const isFinishNode = selectedNode.type === 'completed';
    return (
      <FormGroup key="form-column-settings" className="setting-item table-setting form-column-settings">
        <Label>{gettext('Fields')}</Label>
        <div className="setting-list-container">
          <table className="form-fields-table">
            <thead className="form-fields-table-header">
              <tr>
                <th width='40%'>{''}</th>
                {!isInitNode && (
                  <th width='30%' className="column-checkbox">{gettext('Visible')}</th>
                )}
                {!isFinishNode && (
                  <th width='30%' className="column-checkbox">{gettext('Editable')}</th>
                )}
              </tr>
            </thead>
            <tbody>
              <tr className="form-fields-row">
                <td>
                  <span className="form-fields-select-all">{gettext('Select all')}</span>
                </td>
                {!isInitNode && (
                  <td className="column-checkbox">
                    <input
                      type='checkbox'
                      checked={isAllColumnsVisible ? 'checked' : ''}
                      onChange={this.onChangeAllColumnsVisible}
                    />
                  </td>
                )}
                {!isFinishNode && (
                  <td className="column-checkbox">
                    <input
                      type='checkbox'
                      checked={isAllColumnsEditable ? 'checked' : ''}
                      onChange={this.onChangeAllColumnsEditable}
                    />
                  </td>
                )}
              </tr>
              {columns.map(column => {
                const visibleChecked = !!readOnlyColumnsMap[column.key] || !!readWriteColumnsMap[column.key];
                const editableChecked = !!readWriteColumnsMap[column.key];
                if (isInitNode && !WORKFLOW_SUPPORT_EDIT_TYPE_MAP[column.type]) return null;
                return (
                  <tr key={column.key} className="form-fields-row">
                    <td className="pl-2" title={column.name}>
                      <i className={`${COLUMNS_ICON_CONFIG[column.type]} mr-2 form-field-icon`}></i>
                      <span>{column.name}</span>
                    </td>
                    {!isInitNode && (
                      <td className="column-checkbox">
                        <input
                          type='checkbox'
                          checked={visibleChecked ? 'checked' : ''}
                          onChange={this.onChangeColumnVisible.bind(this, column.key, !visibleChecked)}
                        />
                      </td>
                    )}
                    {!isFinishNode && (
                      <td className="column-checkbox">
                        {WORKFLOW_SUPPORT_EDIT_TYPE_MAP[column.type] &&
                          <input
                            type='checkbox'
                            checked={editableChecked ? 'checked' : ''}
                            onChange={this.onChangeColumnEditable.bind(this, column.key, !editableChecked)}
                          />
                        }
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </FormGroup>
    );
  }
}

WorkflowFormColumnSettings.propTypes = {
  workflowConfig: PropTypes.object,
  dtableUtils: PropTypes.object,
  updateWorkflowConfig: PropTypes.func,
  selectedNode: PropTypes.object,
  changeNode: PropTypes.func,
};

export default WorkflowFormColumnSettings;
