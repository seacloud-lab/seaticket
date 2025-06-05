import React from 'react';
import PropTypes from 'prop-types';
import { CellType, getTableById } from 'dtable-utils';
import { FormGroup, Label, Row, Col } from 'reactstrap';
import { gettext } from '../../../../utils/constants';
import OptionUtils from '../../../../utils/option-utils';
import { DTableSelect } from 'dtable-ui-component';
import CommonAddTool from '../../../../components/common-add-tool';
import { NODE_ACTION_SUPPORT_LINK_RECORD_COLUMN_TYPES } from '../../../constants';

class LinkRecords extends React.Component {

  constructor(props) {
    super(props);
    const { action, columns, currentTableID, tables } = props;
    const { column_key = '', match_conditions = [] } = action;
    this.linkColumns = columns.filter(column => column.type === CellType.LINK);
    this.linkColumnOptions = OptionUtils.generatorKeyLabelOptions(this.linkColumns);
    const selectedLinkColumnOption = this.linkColumnOptions.find(option => option.value === column_key);
    const currentTable = getTableById(tables, currentTableID);
    const currentTableColumns = (currentTable.columns || []).filter(column => NODE_ACTION_SUPPORT_LINK_RECORD_COLUMN_TYPES.includes(column.type));
    this.currentTableColumnOptions = OptionUtils.generatorIconColumnOptions(currentTableColumns);
    this.initLinkedTable(selectedLinkColumnOption);
    this.state = {
      selectedLinkColumnOption,
      matchConditions: selectedLinkColumnOption ? match_conditions : [],
    };
  }

  initLinkedTable = (selectedLinkColumnOption) => {
    if (!selectedLinkColumnOption) {
      this.linkedTableColumnOptions = [];
      return;
    }
    const selectedLinkColumn = this.linkColumns.find(column => column.key === selectedLinkColumnOption.value);
    const { data } = selectedLinkColumn || {};
    const { table_id, other_table_id } = data || {};
    const { currentTableID, tables } = this.props;
    const linked_table_id = currentTableID === table_id ? other_table_id : table_id;
    const linkedTable = getTableById(tables, linked_table_id);
    if (!linkedTable) {
      this.linkedTableColumnOptions = [];
      return;
    }
    const { columns } = linkedTable;
    const validColumns = columns.filter(column => NODE_ACTION_SUPPORT_LINK_RECORD_COLUMN_TYPES.includes(column.type));
    this.linkedTableColumnOptions = OptionUtils.generatorIconColumnOptions(validColumns);
  };

  updateAction = (update) => {
    this.setState(update, () => {
      const { selectedLinkColumnOption, matchConditions } = this.state;
      const selectedLinkColumn = this.linkColumns.find(column => column.key === selectedLinkColumnOption.value);
      const { data, key } = selectedLinkColumn || {};
      const { link_id, table_id, other_table_id } = data || {};
      const { currentTableID, action } = this.props;
      const linked_table_id = currentTableID === table_id ? other_table_id : table_id;
      const newAction = { ...action, column_key: key, link_id, linked_table_id, match_conditions: matchConditions };
      this.props.onUpdateAction(newAction);
    });
  };

  onLinkColumnChanged = (selectedLinkColumnOption) => {
    if (this.state.selectedLinkColumnOption && this.state.selectedLinkColumnOption.value === selectedLinkColumnOption.value) return;
    this.initLinkedTable(selectedLinkColumnOption);
    this.updateAction({ selectedLinkColumnOption, matchConditions: [] });
  };

  onAddCondition = () => {
    const { matchConditions } = this.state;
    let newMatchConditions = matchConditions.slice(0, );
    newMatchConditions.push({ column_key: '', other_column_key: '' });
    this.updateAction({ matchConditions: newMatchConditions });
  };

  deleteCondition = (conditionIndex) => {
    const { matchConditions } = this.state;
    let newMatchConditions = matchConditions.slice(0, );
    newMatchConditions.splice(conditionIndex, 1);
    this.updateAction({ matchConditions: newMatchConditions });
  };

  changeCurrentTableColumn = (columnOption, conditionIndex) => {
    const { matchConditions } = this.state;
    let newMatchConditions = matchConditions.slice(0, );
    const updatedCondition = newMatchConditions[conditionIndex];
    newMatchConditions[conditionIndex] = { ...updatedCondition, column_key: columnOption.value.column.key };
    this.updateAction({ matchConditions: newMatchConditions });
  };

  changeLinkTableColumn = (columnOption, conditionIndex) => {
    const { matchConditions } = this.state;
    let newMatchConditions = matchConditions.slice(0, );
    const updatedCondition = newMatchConditions[conditionIndex];
    newMatchConditions[conditionIndex] = { ...updatedCondition, other_column_key: columnOption.value.column.key };
    this.updateAction({ matchConditions: newMatchConditions });
  };

  render() {
    if (this.linkColumns.length === 0) {
      return (
        <div className="node-action-empty-content-tip">
          {gettext('No link columns in this table')}
        </div>
      );
    }

    const { selectedLinkColumnOption, matchConditions } = this.state;
    const preClassName = 'workflow-node-link-record-action-condition-';
    return (
      <>
        <FormGroup className="node-action-select-link-column">
          <Label>{gettext('Select link column in this table')}</Label>
          <DTableSelect
            value={selectedLinkColumnOption}
            options={this.linkColumnOptions}
            onChange={this.onLinkColumnChanged}
            placeholder={gettext('Select link column')}
            menuPortalTarget={'.workflow-node-action-settings-modal'}
            noOptionsMessage={() => {
              return <span>{gettext('No columns')}</span>;
            }}
          />
        </FormGroup>
        {matchConditions.map((condition, index) => {
          const { column_key, other_column_key } = condition;
          const selectedColumnOption = this.currentTableColumnOptions.find(option => option.value.column.key === column_key);
          const selectedLinkedColumnOption = this.linkedTableColumnOptions.find(option => option.value.column.key === other_column_key);
          return (
            <FormGroup className={`${preClassName}container pl-0 pr-0`} key={index}>
              <Row form>
                <Col md={5}>
                  <Label className='item-label'>{index === 0 ? gettext('If column') : gettext('and column')}</Label>
                  <DTableSelect
                    classNamePrefix='data-processing-popover'
                    value={selectedColumnOption}
                    options={this.currentTableColumnOptions}
                    onChange={(value) => {this.changeCurrentTableColumn(value, index);}}
                    placeholder={gettext('Select column')}
                    menuPortalTarget={'.workflow-node-action-settings-modal'}
                  />
                </Col>
                <Col md={2} className={`${preClassName}equals`}>
                  <span>{gettext('equals')}</span>
                </Col>
                <Col md={4} className={`${preClassName}more`}>
                  <Label className='item-label'>{gettext('column')}</Label>
                  <DTableSelect
                    classNamePrefix='data-processing-popover'
                    value={selectedLinkedColumnOption}
                    onChange={(value) => {this.changeLinkTableColumn(value, index);}}
                    options={this.linkedTableColumnOptions}
                    placeholder={gettext('Select column')}
                    menuPortalTarget={'.workflow-node-action-settings-modal'}
                  />
                </Col>
                <Col md={1} className={`${preClassName}delete`}>
                  <div className={`${preClassName}delete-content`} onClick={() => this.deleteCondition(index)}>
                    <i className="dtable-font dtable-icon-fork-number"></i>
                  </div>
                </Col>
              </Row>
            </FormGroup>
          );
        })}
        {selectedLinkColumnOption && (
          <CommonAddTool
            className="workflow-node-action-add-update-record-field mb-0"
            footerName={gettext('Add')}
            callBack={this.onAddCondition}
          />
        )}
      </>
    );
  }
}

LinkRecords.propTypes = {
  action: PropTypes.object,
  columns: PropTypes.array,
  currentTableID: PropTypes.string,
  tables: PropTypes.array,
  onUpdateAction: PropTypes.func,
};

export default LinkRecords;
