import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { CellType } from 'dtable-utils';
import FormSettingColumnItem from './form-setting-column-item';
import { FORM_ELEMENTS_TYPE } from '../../../constants/form-constants';

const gettext = window.gettext;

class FormSettingColumn extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowLabels: true,
    };
  }

  onShowLabelsToggle = () => {
    this.setState({ isShowLabels: !this.state.isShowLabels });
  };

  onColumnShownChange = (columnKey, update) => {
    let { columns, elementsOrder } = this.props;
    const selectedColumnIndex = columns.findIndex(column => column.key === columnKey);
    const selectedColumn = { ...columns[selectedColumnIndex], ...update };
    columns[selectedColumnIndex] = selectedColumn;
    let newNavigationItem = { key: columnKey, type: FORM_ELEMENTS_TYPE.COLUMN };
    elementsOrder.push(newNavigationItem);
    const allFieldsRequired = columns.every(column => {
      const { type } = column;
      if (type === CellType.CHECKBOX) {
        return column.require_fill_checked;
      }
      return column.is_required;
    });
    this.props.onSave({ currentColumns: columns, elementsOrder, isSetAllFieldsRequired: allFieldsRequired });
  };

  onAddAll = () => {
    let { columns, elementsOrder } = this.props;
    let addColumnKeys = [];
    columns.forEach(column => {
      if (!column.editable) {
        column['editable'] = true;
        addColumnKeys.push(column.key);
      }
    });
    addColumnKeys.forEach(key => {
      const newNavigationItem = { key, type: FORM_ELEMENTS_TYPE.COLUMN };
      elementsOrder.push(newNavigationItem);
    });
    this.props.onSave({ currentColumns: columns, elementsOrder });
  };

  render() {
    const { columns } = this.props;
    const { isShowLabels } = this.state;
    const displayColumns = columns.filter(column => !column.editable);
    const canAddNewColumn = displayColumns.length > 0 ? true : false;

    return (
      <div className="table-setting">
        <div className="column-setting-header">
          <div className="title">{gettext('Table fields')}</div>
          <div>
            {canAddNewColumn && <span className="add-all mr-2" onClick={this.onAddAll}>{gettext('Add all')}</span>}
            <span className="mr-1" onClick={this.onShowLabelsToggle}>
              <i className={`dtable-font dtable-icon-right ${isShowLabels ? 'dtable-icon-spin' : ''}`}></i>
            </span>
          </div>
        </div>
        {!canAddNewColumn &&
          <div className="form-no-columns-tip">
            <span>{gettext('All fields have been added to the form. To add new fields, open the base in the base editor.')}</span>
          </div>
        }
        {isShowLabels && canAddNewColumn && Array.isArray(columns) && (
          <div className="column-setting-container">
            {displayColumns.map(column => {
              return (
                <FormSettingColumnItem
                  key={column.key}
                  column={column}
                  onChange={this.onColumnShownChange}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }
}

FormSettingColumn.propTypes = {
  columns: PropTypes.array,
  elementsOrder: PropTypes.array,
  onSave: PropTypes.func,
};

export default FormSettingColumn;
