import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { UncontrolledTooltip } from 'reactstrap';
import { COLUMNS_ICON_CONFIG } from 'dtable-store';
import DTablePopover from '../../../../components/dtable-popover';
import Icon from '../../../../components/icon';

import './excel-import-adjust.css';

const gettext = window.gettext;

const propTypes = {
  tables: PropTypes.array,
  tableIndex: PropTypes.number,
  includedTables: PropTypes.array,
  tableIncludedColumns: PropTypes.object,
  checkAllTable: PropTypes.func.isRequired,
  uncheckAllTable: PropTypes.func.isRequired,
  checkAllField: PropTypes.func.isRequired,
  uncheckAllField: PropTypes.func.isRequired,
  onCheckColumn: PropTypes.func.isRequired,
  onCheckTable: PropTypes.func.isRequired,
  toggleImportSelect: PropTypes.func.isRequired,
  isShowImportSelect: PropTypes.bool.isRequired,
};

class ExcelImportAdjust extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowSelectField: false,
      isShowSelectTable: false,
    };
  }

  toggleSelectField = () => {
    this.setState({
      isShowSelectField: !this.state.isShowSelectField,
    });
  };

  toggleSelectTable = () => {
    this.setState({
      isShowSelectTable: !this.state.isShowSelectTable,
    });
  };

  changeSelectAllTable = (e) => {
    if (e.target.checked) {
      this.props.checkAllTable();
    } else {
      this.props.uncheckAllTable();
    }
  };

  changeSelectAllField = (e) => {
    if (e.target.checked) {
      this.props.checkAllField();
    } else {
      this.props.uncheckAllField();
    }
  };

  render() {
    let { tables, tableIndex, includedTables, tableIncludedColumns, isShowImportSelect } = this.props;
    let { isShowSelectTable, isShowSelectField } = this.state;
    let table = tables[tableIndex];
    let { columns } = table;
    let includedColumns = tableIncludedColumns[table.name];

    return (
      <div className="excel-import-adjust">
        <div onClick={this.props.toggleImportSelect} className='cursor-pointer'>
          <span aria-hidden="true" className={`mr-1 dtable-font dtable-icon-${isShowImportSelect ? 'up' : 'down'}`}></span>
          <span>{gettext('Customize the import')}</span>
          <span className='dtable-font dtable-icon-use-help ml-1' id='customize-import-tip'></span>
          <UncontrolledTooltip
            popperClassName="customize-import-excel"
            placement='left'
            target='customize-import-tip'
          >
            <div>{gettext('SeaTable analyzes the first 200 rows in the imported columns to determine the target column types in the base. If SeaTable picks the wrong column type, you can change the column type using the "Customize column type" action after the import is completed.')}</div>
            <div>{gettext('Please note that dots ( . ) and braces ( { } ) in column headers are not supported and are replaced by underscore.')}</div>
          </UncontrolledTooltip>
        </div>
        {isShowImportSelect &&
          <div className="excel-import-adjust-select">
            <span className="mt-1 mb-1 ">{gettext('Choose the tables and columns you want to import from this file.')}</span>
            <div className="excel-import-select-container">
              {/* select column */}
              <div>
                <div className={classnames('excel-import-adjust-select-container custom-select', { 'focus': isShowSelectField })} onClick={this.toggleSelectField}>
                  <div className="excel-import-adjust-select-inner">
                    <div>
                      <Icon symbol="field-set" />
                      <span className='ml-1'>{gettext('Columns')}</span>
                    </div>
                    <i aria-hidden="true" className="dtable-font dtable-icon-down3"></i>
                  </div>
                </div>
                <span id='adjust-import-select-field'></span>
              </div>
              {/* select table */}
              <div>
                <div className={classnames('excel-import-adjust-select-container custom-select', { 'focus': isShowSelectTable })} onClick={this.toggleSelectTable}>
                  <div className="excel-import-adjust-select-inner">
                    <div>
                      <i aria-hidden="true" className="dtable-font dtable-icon-table mr-1"></i>
                      <span>{gettext('Tables')}</span>
                    </div>
                    <i aria-hidden="true" className="dtable-font dtable-icon-down3"></i>
                  </div>
                </div>
                <span id='adjust-import-select-table'></span>
              </div>
            </div>
          </div>
        }
        {isShowSelectField &&
          <DTablePopover
            target="adjust-import-select-field"
            popoverClassName="excel-import-adjust-popover"
            hideDTablePopover={this.toggleSelectField}
            hideDTablePopoverWithEsc={this.toggleSelectField}
          >
            <div className="excel-import-adjust-select-option" key='select-all'>
              <input
                type="checkbox"
                onChange={this.changeSelectAllField}
                checked={includedColumns.length === columns.length}
                className="mr-2"
              />
              {gettext('Select all')}
            </div>
            {columns.map((column, index) => {
              const { name, type } = column;
              if (index === 0) {
                return (
                  <div className="excel-import-adjust-select-option excel-import-adjust-select-option-disabled" key={name}>
                    <input
                      type="checkbox"
                      key={index + '-'}
                      checked={true}
                      className="mr-2"
                      disabled
                    />
                    <span className="header-icon">
                      <i className={COLUMNS_ICON_CONFIG[type]}></i>
                    </span>
                    <span className="header-name" title={name}>{name}</span>
                  </div>
                );
              }
              return (
                <div className="excel-import-adjust-select-option text-truncate" key={name}>
                  <input
                    type="checkbox"
                    key={index + '-'}
                    onChange={() => {this.props.onCheckColumn(table.name, column, includedColumns.includes(name));}}
                    checked={includedColumns.includes(name)}
                    className="mr-2"
                  />
                  <span className="header-icon">
                    <i className={COLUMNS_ICON_CONFIG[type]}></i>
                  </span>
                  <span className="header-name" title={name}>{name}</span>
                </div>
              );
            })}
          </DTablePopover>
        }
        {isShowSelectTable &&
          <DTablePopover
            target="adjust-import-select-table"
            popoverClassName="excel-import-adjust-popover"
            hideDTablePopover={this.toggleSelectTable}
            hideDTablePopoverWithEsc={this.toggleSelectTable}
          >
            <div className="excel-import-adjust-select-option" key='select-all'>
              <input
                type="checkbox"
                onChange={this.changeSelectAllTable}
                checked={includedTables.length === tables.length}
                className="mr-2"
              />
              {gettext('Select all')}
            </div>
            {tables.map((item, index) => {
              const { name } = item;
              if (index === 0) {
                return (
                  <div className="excel-import-adjust-select-option excel-import-adjust-select-option-disabled" key={name}>
                    <input
                      type="checkbox"
                      key={index + '-'}
                      checked={true}
                      className="mr-2"
                      disabled
                    />
                    {name}
                  </div>
                );
              }
              return (
                <div className="excel-import-adjust-select-option" key={name}>
                  <input
                    type="checkbox"
                    key={index + '-'}
                    onChange={() => {this.props.onCheckTable(name, includedTables.includes(name));}}
                    checked={includedTables.includes(name)}
                    className="mr-2"
                  />
                  {name}
                </div>
              );
            })}
          </DTablePopover>
        }
      </div>
    );
  }
}

ExcelImportAdjust.propTypes = propTypes;

export default ExcelImportAdjust;
