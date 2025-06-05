import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import {
  FILTER_PREDICATE_TYPE,
  FILTER_TERM_MODIFIER_TYPE,
  FILTER_COLUMN_OPTIONS,
  filterTermModifierNotWithin,
  filterTermModifierIsWithin,
  CellType,
  COLUMN_OPTIONS,
  ValidateFilter,
} from 'dtable-utils';
import { DTableCustomizeSelect } from 'dtable-ui-component';
import { FILTER_PREDICATE_SHOW, FILTER_TERM_MODIFIER_SHOW } from '../../../constants/filter-show-constants';
import FiltersTooltip from './filters-tooltip';
import { isFilterTermArray } from '../../../utils/filters-utils';
import CheckboxEditor from '../../../components-form/cell-editor/checkbox-editor/index';

const gettext = window.gettext;

const propTypes = {
  filters: PropTypes.array.isRequired,
  filteredColumns: PropTypes.array.isRequired,
  currentColumns: PropTypes.array.isRequired,
  filterConjunction: PropTypes.string.isRequired,
  updateFilters: PropTypes.func.isRequired,
  updateFilterConjunction: PropTypes.func.isRequired,
};

class EditRowItemFilters extends React.Component {

  updateFilter = (filterIndex, updatedFilter) => {
    let { filters } = this.props;
    filters[filterIndex] = Object.assign({}, filters[filterIndex], updatedFilter);
    this.props.updateFilters(filters);
  };

  deleteFilter = (filterIndex) => {
    let { filters } = this.props;
    let newFilters = filters.slice(0);
    newFilters.splice(filterIndex, 1);
    this.props.updateFilters(newFilters);
  };

  onSelectConjunction = (value) => {
    this.props.updateFilterConjunction(value.filterConjunction);
  };

  onSelectColumn = (value) => {
    const { filters } = this.props;
    const { filterIndex, column } = value;
    const { type: columnType, key: columnKey } = column;
    const filter = filters[filterIndex];
    if (filter.column_key === columnKey) {
      return;
    }

    let { filterPredicateList } = FILTER_COLUMN_OPTIONS[columnType];
    let filterPredicate = filterPredicateList[0];
    let updatedFilter = Object.assign({}, filter, { column_key: columnKey, filter_predicate: filterPredicate });
    if (columnType === CellType.CHECKBOX) {
      updatedFilter.filter_term = false;
    } else if (isFilterTermArray(column, filterPredicate)) {
      updatedFilter.filter_term = [];
    } else if (columnType === CellType.DATE) {
      let filterTermModifier = filterPredicate === FILTER_PREDICATE_TYPE.IS_WITHIN ? filterTermModifierIsWithin[0] : filterTermModifierNotWithin[0];
      updatedFilter.filter_term_modifier = filterTermModifier;
      updatedFilter.filter_term = '';
    } else {
      updatedFilter.filter_term = '';
    }

    this.updateFilter(filterIndex, updatedFilter);
  };

  onSelectPredicate = (value) => {
    const { filterIndex, filterPredicate } = value;
    const { filters, currentColumns } = this.props;
    const filter = filters[filterIndex];
    if (filter.filter_predicate === filterPredicate) {
      return;
    }
    let updatedFilter = Object.assign({}, filter, { filter_predicate: filterPredicate, filter_term: '' });
    let filterColumn = currentColumns.find(column => column.key === filter.column_key);
    let { type: columnType } = filterColumn;
    if (columnType === CellType.CHECKBOX) {
      updatedFilter.filter_term = false;
    } else if (isFilterTermArray(columnType, filterPredicate)) {
      updatedFilter.filter_term = [];
    } else if (columnType === CellType.DATE) {
      let filterTermModifier = filterPredicate === FILTER_PREDICATE_TYPE.IS_WITHIN ? filterTermModifierIsWithin[0] : filterTermModifierNotWithin[0];
      updatedFilter.filter_term_modifier = filterTermModifier;
    }

    this.updateFilter(filterIndex, updatedFilter);
  };

  onSelectTermModifier = (value) => {
    const { filterIndex, filterTermModifier } = value;
    const { filters } = this.props;
    const filter = filters[filterIndex];
    if (filter.filter_term_modifier === filterTermModifier) {
      return;
    }
    let updatedFilter = Object.assign({}, filter, { filter_term_modifier: filterTermModifier });
    this.updateFilter(filterIndex, updatedFilter);
  };

  onFilterValueChange = (filterIndex, columnIdx, event) => {
    const { filters, currentColumns } = this.props;
    const filterColumn = currentColumns[columnIdx];
    const filter = filters[filterIndex];
    let filterTerm;
    if (filterColumn.type === CellType.CHECKBOX) {
      filterTerm = event[filterColumn.key];
    } else {
      filterTerm = event.target.value;
    }
    if (filter.filter_term === filterTerm) {
      return;
    }
    let updatedFilter = Object.assign({}, filter, { filter_term: filterTerm });
    this.updateFilter(filterIndex, updatedFilter);
  };

  onSelectSingle = (value) => {
    const { filters } = this.props;
    const { filterIndex, columnOption } = value;
    const filter = filters[filterIndex];
    if (filter.filter_term === columnOption.id) {
      return;
    }
    let updatedFilter = Object.assign({}, filter, { filter_term: columnOption.id });
    this.updateFilter(filterIndex, updatedFilter);
  };

  onSelectMultiple = (value) => {
    const { filters } = this.props;
    const { filterIndex, columnOption } = value;
    const filter = filters[filterIndex];
    let filterTerm = filter.filter_term ? filter.filter_term : [];
    let index = filterTerm.indexOf(columnOption.id);
    if (index > -1) {
      filterTerm.splice(index, 1);
    } else {
      filterTerm.push(columnOption.id);
    }
    let updatedFilter = Object.assign({}, filter, { filter_term: filterTerm });
    this.updateFilter(filterIndex, updatedFilter);
  };

  createConjunction = () => {
    return [
      {
        value: { filterConjunction: 'And' },
        label: (<span className='select-option-name'>{gettext('And')}</span>)
      },
      {
        value: { filterConjunction: 'Or' },
        label: (<span className='select-option-name'>{gettext('Or')}</span>)
      }
    ];
  };

  getColumnOptions = (column) => {
    if (!column || !column.data || !Array.isArray(column.data.options)) {
      return [];
    }
    return column.data.options;
  };

  createMultipleSelectOptions = (filterIndex, column, filterTerm) => {
    return this.getColumnOptions(column).map((option) => {
      return {
        value: { filterIndex, columnOption: option },
        label:
        (
          <div className='select-option-name multiple-option-name'>
            <div className='multiple-check-icon'>
              {filterTerm.indexOf(option.id) > -1 && <i className="option-edit dtable-font dtable-icon-check-mark"></i>}
            </div>
            <div className="multiple-select-option" style={{ background: option.color, color: option.textColor || null }} title={option.name}>{option.name}</div>
          </div>
        )
      };
    });
  };

  createSingleSelectOptions = (filterIndex, column) => {
    return this.getColumnOptions(column).map((option) => {
      return {
        value: { filterIndex, columnOption: option },
        label: (
          <div className='select-option-name'>
            <div className="single-select-option" style={{ background: option.color, color: option.textColor || null }} title={option.name}>{option.name}</div>
          </div>
        )
      };
    });
  };

  createTermModifierOptions = (filterIndex, filterTermModifierList) => {
    return filterTermModifierList.map((filterTermModifier) => {
      return {
        value: { filterIndex, filterTermModifier },
        label: <span className='select-option-name'>{FILTER_TERM_MODIFIER_SHOW[filterTermModifier]}</span>
      };
    });
  };

  createPredicateOptions = (filterIndex, filterPredicateList) => {
    return filterPredicateList.map((filterPredicate) => {
      return {
        value: { filterIndex, filterPredicate },
        label: <span className='select-option-name'>{FILTER_PREDICATE_SHOW[filterPredicate]}</span>
      };
    });
  };

  createColumnsOptions = (filterIndex) => {
    let { filteredColumns } = this.props;
    let options = [];
    filteredColumns.forEach((column) => {
      let { type: columnType, name: columnName } = column;
      if (FILTER_COLUMN_OPTIONS[columnType]) {
        let columnOption = COLUMN_OPTIONS.find(item => item.type === columnType);
        options.push(
          {
            value: { filterIndex, column },
            label: (
              <Fragment>
                <span className="header-icon"><i className={columnOption.iconClass}></i></span>
                <span className='select-option-name'>{columnName}</span>
              </Fragment>
            )
          }
        );
      }
    });
    return options;
  };

  renderFilterItem = (i, filterColumn, filterPredicate, filterPredicateList, filterTermEle, filterTermModifierList, filterTermModifier) => {
    const filterPreLabel = [FILTER_PREDICATE_TYPE.EMPTY, FILTER_PREDICATE_TYPE.NOT_EMPTY];
    let { filterConjunction, filteredColumns, filters } = this.props;
    const { name, type: columnType, key } = filterColumn;
    let columnOption = COLUMN_OPTIONS.find(item => item.type === columnType);
    let filterConjunctionShow; let filterConjunctionText;
    filterConjunction = filterConjunction || 'Or';
    filterConjunctionText = filterConjunction === 'And' ? gettext('And') : gettext('Or');
    if (i === 0) {
      filterConjunctionShow = '';
    } else if (i === 1) {
      let selectedConjunction = { label: <span className='select-option-name'>{filterConjunctionText}</span> };
      filterConjunctionShow = (
        <DTableCustomizeSelect
          value={selectedConjunction}
          onSelectOption={this.onSelectConjunction}
          options={this.createConjunction()}
        />
      );
    } else {
      filterConjunctionShow = <span className="selected-conjunction-show">{filterConjunctionText}</span>;
    }
    let selectedColumn = {
      label: (
        <Fragment>
          <span className="header-icon"><i className={`dtable-font ${columnOption.iconClass}`}></i></span>
          <span className='select-option-name'>{name}</span>
        </Fragment>
      )
    };
    let selectedPredicate = { label: <span className='select-option-name'>{FILTER_PREDICATE_SHOW[filterPredicate]}</span> };
    let selectedTermModifier = { label: <span className='select-option-name'>{FILTER_TERM_MODIFIER_SHOW[filterTermModifier]}</span> };
    let filterErrorMsg = ValidateFilter.validate(filters[i], filteredColumns).error_message;
    return (
      <div className="filter-item" key={i}>
        <div className="delete-filter" onClick={this.deleteFilter.bind(this, i)}>
          <i className="dtable-font dtable-icon-fork-number"></i>
        </div>
        <div className="condition">
          <div className="filter-conjunction">{filterConjunctionShow}</div>
          <div className="filter-container">
            <div className="filter-column">
              <DTableCustomizeSelect
                value={selectedColumn}
                onSelectOption={this.onSelectColumn}
                options={this.createColumnsOptions(i)}
              />
            </div>
            <div className="filter-predicate ml-2">
              {columnType === CellType.CHECKBOX ?
                <span className="filter-predicate-checkbox">{selectedPredicate.label}</span>
                :
                <DTableCustomizeSelect
                  value={selectedPredicate}
                  onSelectOption={this.onSelectPredicate}
                  options={this.createPredicateOptions(i, filterPredicateList)}
                />
              }
            </div>
            {columnType === CellType.DATE && filterPreLabel.indexOf(filterPredicate) < 0 &&
              <div className="filter-term-modifier ml-2">
                <DTableCustomizeSelect
                  value={selectedTermModifier}
                  onSelectOption={this.onSelectTermModifier}
                  options={this.createTermModifierOptions(i, filterTermModifierList)}
                />
              </div>
            }
            <div
              className={`filter-term ml-2 ${columnType === CellType.SINGLE_SELECT || columnType === CellType.MULTIPLE_SELECT ? 'form-filter-selector' : ''}`}
            >
              {filterTermEle}
            </div>
          </div>
        </div>
        <div className="invalid-filter-item">
          {(filterErrorMsg && filterErrorMsg !== 'incomplete filter') &&
            <FiltersTooltip
              id={`filter-tip-warning-${i}-${key}`}
              description={gettext('Invalid filter')}
              type="warning"
            />
          }
        </div>
      </div>
    );
  };

  renderMultipleSelect = (options, filterTerm, filterIndex, filterColumn) => {
    let selectedOptionNames = {};
    let labelArray = [];
    if (Array.isArray(options) && Array.isArray(filterTerm)) {
      filterTerm.forEach((item) => {
        let inOption = options.find(option => option.id === item);
        if (inOption) {
          let optionStyle = {
            background: inOption.color,
            color: inOption.textColor || null,
            margin: '0 10px 0 0'
          };
          labelArray.push(<span className='select-option-name multiple-select-option' style={optionStyle} key={'option_' + item}>{inOption.name}</span>);
        }
      });
    }
    selectedOptionNames = { label: (<Fragment>{labelArray}</Fragment>) };
    return (
      <DTableCustomizeSelect
        className="selector-multiple-select"
        value={selectedOptionNames}
        onSelectOption={this.onSelectMultiple}
        options={this.createMultipleSelectOptions(filterIndex, filterColumn, filterTerm)}
        placeholder={gettext('Select option(s)')}
        searchable={true}
        searchPlaceholder={gettext('Search option')}
        noOptionsPlaceholder={gettext('No options available')}
      />
    );
  };

  renderFiltersList = () => {
    let { filters, currentColumns } = this.props;
    return filters.map((filter, i) => {
      let { column_key, filter_predicate: filterPredicate, filter_term: filterTerm, filter_term_modifier: filterTermModifier } = filter;
      const columnIdx = currentColumns.findIndex(item => item.key === column_key);
      if (columnIdx < 0) {
        return null;
      }
      const filterColumn = currentColumns[columnIdx];
      const { type: columnType } = filterColumn;
      const { filterPredicateList } = FILTER_COLUMN_OPTIONS[columnType];
      let filterTermEle;
      if ([CellType.TEXT, CellType.GEOLOCATION, CellType.NUMBER, CellType.RATE, CellType.EMAIL, CellType.DURATION, CellType.URL].includes(columnType)) {
        filterTermEle = <input type={'text'} value={filterTerm} onChange={this.onFilterValueChange.bind(this, i, columnIdx)} />;
      } else if (columnType === CellType.CHECKBOX) {
        filterTermEle = (
          <CheckboxEditor
            value={filterTerm}
            column={filterColumn}
            onCommit={this.onFilterValueChange.bind(this, i, columnIdx)}
            readOnly={false}
          />
        );
      } else if (columnType === CellType.SINGLE_SELECT) {
        const options = (filterColumn.data && filterColumn.data.options) || [];
        if ([FILTER_PREDICATE_TYPE.IS_ANY_OF, FILTER_PREDICATE_TYPE.IS_NONE_OF].includes(filterPredicate)) {
          filterTermEle = this.renderMultipleSelect(options, filterTerm, i, filterColumn);
        } else {
          let selectedOption = options.find(option => option.id === filterTerm);
          let selectedOptionName = selectedOption ? {
            label: (
              <span
                className='select-option-name single-select-option'
                style={{ background: selectedOption.color, color: selectedOption.textColor || null }}
              >{selectedOption.name}
              </span>
            )
          } : {};
          filterTermEle = <DTableCustomizeSelect
            className="selector-single-select"
            value={selectedOptionName}
            onSelectOption={this.onSelectSingle}
            options={this.createSingleSelectOptions(i, filterColumn)}
            placeholder={gettext('Select an option')}
            searchable={true}
            searchPlaceholder={gettext('Search option')}
            noOptionsPlaceholder={gettext('No options available')}
          />;
        }
      } else if (columnType === CellType.MULTIPLE_SELECT) {
        const options = (filterColumn.data && filterColumn.data.options) || [];
        filterTermEle = this.renderMultipleSelect(options, filterTerm, i, filterColumn);
      } else if (columnType === CellType.DATE) {
        let { filterTermModifierList } = FILTER_COLUMN_OPTIONS[columnType];
        if (filterTermModifierList) {
          filterTermModifierList = filterPredicate === FILTER_PREDICATE_TYPE.IS_WITHIN ? filterTermModifierIsWithin : filterTermModifierList;
          filterTermModifier = filterTermModifier ? filterTermModifier : filterTermModifierList[0];
        }
        const dateLabel = [
          FILTER_TERM_MODIFIER_TYPE.EXACT_DATE,
          FILTER_TERM_MODIFIER_TYPE.NUMBER_OF_DAYS_AGO,
          FILTER_TERM_MODIFIER_TYPE.NUMBER_OF_DAYS_FROM_NOW,
          FILTER_TERM_MODIFIER_TYPE.THE_NEXT_NUMBERS_OF_DAYS,
          FILTER_TERM_MODIFIER_TYPE.THE_PAST_NUMBERS_OF_DAYS
        ];
        const dateEmptyLabel = [FILTER_PREDICATE_TYPE.EMPTY, FILTER_PREDICATE_TYPE.NOT_EMPTY];
        let filterTermEle = '';
        if (dateEmptyLabel.indexOf(filterPredicate) > -1) {
          filterTermEle = '';
          return this.renderFilterItem(i, filterColumn, filterPredicate, filterPredicateList, filterTermEle, filterTermModifierList, filterTermModifier);
        } else {
          if (dateLabel.indexOf(filterTermModifier) > -1) {
            filterTermEle = <input type={'text'} value={filterTerm} onChange={this.onFilterValueChange.bind(this, i, columnIdx)} />;
          } else {
            filterTermEle = '';
          }
          return this.renderFilterItem(i, filterColumn, filterPredicate, filterPredicateList, filterTermEle, filterTermModifierList, filterTermModifier);
        }
      }
      filterTermEle = filterPredicate === FILTER_PREDICATE_TYPE.EMPTY || filterPredicate === FILTER_PREDICATE_TYPE.NOT_EMPTY ? '' : filterTermEle;
      return this.renderFilterItem(i, filterColumn, filterPredicate, filterPredicateList, filterTermEle);
    });
  };

  render() {
    return (
      <div className="filters-list">
        {this.renderFiltersList()}
      </div>
    );
  }
}

EditRowItemFilters.propTypes = propTypes;

export default EditRowItemFilters;
