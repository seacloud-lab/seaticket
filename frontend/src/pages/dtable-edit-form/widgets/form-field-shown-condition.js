import React, { Component } from 'react';
import PropTypes from 'prop-types';
import deepCopy from 'deep-copy';
import { CellType, FILTER_COLUMN_OPTIONS, getValidFilters } from 'dtable-utils';
import ObjectUtils from '../../../utils/object-utils';
import FiltersPopover from '../../dtable/dialog/dataset-widgets/filter-popover';

const gettext = window.gettext;

class FormFieldShownCondition extends Component {

  constructor(props) {
    super(props);
    const { columns, column } = props;
    const filters = column.filters || [];
    const filterConjunction = column.filter_conjunction;
    const validFilters = deepCopy(getValidFilters(filters, columns));
    this.state = {
      isFiltersPopoverShow: false,
      validFilters,
      filterConjunction,
    };
    this.filteredColumns = this.getFilteredColumns(columns);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.column.key !== this.props.column.key) {
      const { columns, column } = nextProps;
      const filters = column.filters || [];
      const filterConjunction = column.filter_conjunction;
      const validFilters = deepCopy(getValidFilters(filters, columns));
      this.setState({ validFilters, filterConjunction });
      this.filteredColumns = this.getFilteredColumns(columns);
    }
  }

  getFilteredColumns = (columns) => {
    let filterColumns = [];
    // The data of the column before the current column determines whether the current column is displayed or not
    columns.forEach((column) => {
      if (column.type !== CellType.LINK && FILTER_COLUMN_OPTIONS[column.type]) {
        filterColumns.push(column);
      }
    });
    return filterColumns;
  };

  onFilterToggle = () => {
    this.setState({ isFiltersPopoverShow: !this.state.isFiltersPopoverShow });
  };

  update = (update) => {
    const { column, columns } = this.props;
    const { filters, filter_conjunction } = update || {};
    let { filters: old_filters, filter_conjunction: old_filter_conjunction } = column;
    const old_valid_filters = getValidFilters(old_filters, columns);
    const valid_filters = getValidFilters(filters, columns);
    const isFiltersChanged = ObjectUtils.isObjectChanged(old_valid_filters, valid_filters);
    if (filter_conjunction !== old_filter_conjunction || isFiltersChanged) {
      const filters = valid_filters;
      const show_on_condition = filters.length > 0 ? true : false;
      this.setState({ validFilters: filters, filterConjunction: filter_conjunction }, () => {
        this.props.onColumnChanged(column.key, { filters, filter_conjunction, show_on_condition });
      });
    }
  };

  render() {
    const { validFilters, filterConjunction } = this.state;
    const filtersLength = validFilters ? validFilters.length : 0;
    let filterMessage = gettext('Add condition');
    if (filtersLength === 1) {
      filterMessage = gettext('Added') + ' ' + gettext('1 condition');
    } else if (filtersLength > 1) {
      filterMessage = gettext('Added') + ' ' + filtersLength + ' ' + gettext('conditions');
    }
    return (
      <>
        <div className="form-filed-setting-item">
          <div className="d-flex align-items-center mb-2">
            {gettext('Show field only when conditions are met')}
          </div>
          <div className={filtersLength === 0 ? 'add-filter' : 'edit-filter'} id="dtable-filter-popover" onClick={this.onFilterToggle}>
            {filtersLength === 0 ?
              <>
                <i className="dtable-font dtable-icon-add-table"></i>
                <span className="add-new-option ml-2">{filterMessage}</span>
              </>
              :
              <>
                <span className="add-new-option">{filterMessage}</span>
                <i className="dtable-font dtable-icon-rename"></i>
              </>
            }
          </div>
        </div>
        {this.state.isFiltersPopoverShow &&
          <FiltersPopover
            columns={this.filteredColumns}
            collaborators={[]} // form module is not support edit collaborators column
            filterConjunction={filterConjunction}
            filters={validFilters}
            update={this.update}
            hideFilterPopover={this.onFilterToggle}
          />
        }
      </>
    );
  }
}

FormFieldShownCondition.propTypes = {
  column: PropTypes.object,
  columns: PropTypes.array,
  onColumnChanged: PropTypes.func,
};

export default FormFieldShownCondition;
