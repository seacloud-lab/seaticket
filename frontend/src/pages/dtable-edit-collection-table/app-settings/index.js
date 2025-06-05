import React from 'react';
import PropTypes from 'prop-types';
import { DTableSelect } from 'dtable-ui-component';
import FormSettingItem from '../../dtable-edit-form/widgets/form-setting-item';
import DeadlineDate from '../../dtable-edit-collection-table/widgets/deadline-date';

const gettext = window.gettext;

const COLLECTION_TABLE_CONFIG_STATE = {
  SUBMIT_DEADLINE: 'submitDeadline',
  IS_SUBMIT_DEADLINE_SHOW: 'isSubmitDeadlineShow',
};

const propTypes = {
  tables: PropTypes.array.isRequired,
  onSave: PropTypes.func.isRequired,
  activeTable: PropTypes.object.isRequired,
  columnsConfig: PropTypes.array.isRequired,
  onTableSelectedChanged: PropTypes.func.isRequired,
  onColumnItemClick: PropTypes.func.isRequired,
  submitDeadline: PropTypes.string,
  isSubmitDeadlineShow: PropTypes.bool,
  onCollectionConfigContentChange: PropTypes.func.isRequired,
  onCollectionConfigContentShowToggle: PropTypes.func.isRequired,
};

class AppSettings extends React.Component {

  constructor(props) {
    super(props);
    this.tableOptions = this.createSelectOptions(props.tables);
  }

  createSelectOptions = (selections) => {
    return selections.map(selection => {
      return this.createSelectOption(selection);
    });
  };

  createSelectOption = (selection) => {
    return ({
      value: { _id: selection._id },
      label: (<span className='select-option-name'>{selection.name}</span>)
    });
  };

  onTableSelectedChanged = (option) => {
    const { value: selectedItem } = option;
    const { tables, activeTable } = this.props;
    if (selectedItem._id === activeTable._id) return;

    const selectTable = tables.find((table) => {
      return table._id === selectedItem._id;
    });
    this.props.onTableSelectedChanged(selectTable);
  };

  onColumnItemClick = (columnKey, flag) => {
    this.props.onColumnItemClick(columnKey, flag);
  };

  render() {
    const { activeTable, columnsConfig, onSave, submitDeadline, isSubmitDeadlineShow, onCollectionConfigContentChange, onCollectionConfigContentShowToggle } = this.props;
    return (
      <div className="collection-table-settings">
        <div className="setting-header">
          <div className="title">{gettext('Settings')}</div>
        </div>
        <div className="setting-body">
          <div className="setting-item">
            <div className="title">{gettext('Table')}</div>
            <DTableSelect
              value={this.createSelectOption(activeTable)}
              options={this.tableOptions}
              onChange={this.onTableSelectedChanged}
            />
          </div>
          <div className="setting-divider"></div>
          <div className="setting-item column-setting">
            <div className="title">{gettext('Fields')}</div>
            <div className="setting-list-container">
              {columnsConfig.map(column => {
                return (
                  <FormSettingItem
                    key={column.key}
                    column={column}
                    onColumnItemClick={this.onColumnItemClick}
                  />
                );
              })}
            </div>
          </div>
          <div className="setting-divider"></div>
          <DeadlineDate
            onDateChange={(dateStr) => onCollectionConfigContentChange(dateStr, COLLECTION_TABLE_CONFIG_STATE.SUBMIT_DEADLINE)}
            onChangeDateShow={() => onCollectionConfigContentShowToggle(COLLECTION_TABLE_CONFIG_STATE.IS_SUBMIT_DEADLINE_SHOW)}
            onSave={onSave}
            date={submitDeadline}
            isDateShow={isSubmitDeadlineShow}
            dateTitle={gettext('Submission deadline')}
          />
        </div>
      </div>
    );
  }
}

AppSettings.propTypes = propTypes;

export default AppSettings;
