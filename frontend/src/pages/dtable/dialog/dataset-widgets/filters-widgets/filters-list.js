import React, { Component } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import {
  CellType,
  ValidateFilter,
  FILTER_COLUMN_OPTIONS,
  FORMULA_COLUMN_TYPES,
  FORMULA_RESULT_TYPE
} from 'dtable-utils';
import FilterItemUtils from './filter-item-utils';
import FilterItem from './filter-item';

import '../../../css/filters-list.css';

const propTypes = {
  isLocked: PropTypes.bool,
  className: PropTypes.string,
  filters: PropTypes.array,
  columns: PropTypes.array.isRequired,
  filterConjunction: PropTypes.string.isRequired,
  updateFilter: PropTypes.func.isRequired,
  deleteFilter: PropTypes.func.isRequired,
  updateFilterConjunction: PropTypes.func,
  scheduleUpdate: PropTypes.func,
  emptyPlaceholder: PropTypes.string,
  value: PropTypes.object,
  collaborators: PropTypes.array,
  departments: PropTypes.array,
};

class FiltersList extends Component {

  constructor(props) {
    super(props);
    this.conjunctionOptions = null;
    this.columnOptions = null;
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.columns !== this.props.columns) {
      this.columnOptions = null;
    }
  }

  updateFilter = (filterIndex, updatedFilter) => {
    if (!updatedFilter) return;
    this.props.updateFilter(filterIndex, updatedFilter);
  };

  deleteFilter = (index) => {
    const { scheduleUpdate } = this.props;
    this.props.deleteFilter(index, scheduleUpdate);
  };

  updateConjunction = (filterConjunction) => {
    this.props.updateFilterConjunction(filterConjunction);
  };

  getConjunctionOptions = () => {
    if (!this.conjunctionOptions) {
      this.conjunctionOptions = FilterItemUtils.generatorConjunctionOptions();
    }
    return this.conjunctionOptions;
  };

  getFilterColumns = () => {
    const { columns } = this.props;
    return columns.filter(column => {
      const { type, data } = column;
      if (data && (type === CellType.LINK ||
        (FORMULA_COLUMN_TYPES.includes(type) && data.result_type === FORMULA_RESULT_TYPE.ARRAY))
      ) {
        return Object.prototype.hasOwnProperty.call(FILTER_COLUMN_OPTIONS, data.array_type);
      }

      return Object.prototype.hasOwnProperty.call(FILTER_COLUMN_OPTIONS, type);
    });
  };

  getColumnOptions = () => {
    if (!this.columnOptions) {
      const filterColumns = this.getFilterColumns();
      this.columnOptions = filterColumns.map(column => {
        return FilterItemUtils.generatorColumnOption(column);
      });
    }
    return this.columnOptions;
  };

  renderFilterItem = (filter, index) => {
    const { filterConjunction, columns, value, departments } = this.props;
    const { column_key } = filter;

    const filterColumn = columns.find(column => column.key === column_key) || {};
    const { error_message } = ValidateFilter.validateColumn(column_key, columns);
    const conjunctionOptions = this.getConjunctionOptions();
    const columnOptions = this.getColumnOptions();
    return (
      <FilterItem
        key={index}
        isLocked={this.props.isLocked}
        index={index}
        errMsg={error_message}
        filter={filter}
        filterColumn={filterColumn}
        filterConjunction={filterConjunction}
        conjunctionOptions={conjunctionOptions}
        filterColumnOptions={columnOptions}
        value={value}
        departments={departments}
        deleteFilter={this.deleteFilter}
        updateFilter={this.updateFilter}
        updateConjunction={this.updateConjunction}
        collaborators={this.props.collaborators}
      />
    );
  };

  render() {
    let { filters, className, emptyPlaceholder } = this.props;
    const isEmpty = filters.length === 0;
    return (
      <div className={classnames('filters-list', { 'empty-filters-container': isEmpty }, { [className]: className })}>
        {isEmpty && <div className="empty-filters-list">{emptyPlaceholder}</div>}
        {!isEmpty && filters.map((filter, index) => {
          return this.renderFilterItem(filter, index);
        })}
      </div>
    );
  }
}

FiltersList.propTypes = propTypes;

export default FiltersList;
