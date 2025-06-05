import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { UncontrolledTooltip } from 'reactstrap';
import {
  CellType,
  FILTER_PREDICATE_TYPE,
  FILTER_TERM_MODIFIER_TYPE,
  filterTermModifierIsWithin,
  isDateColumn,
  FORMULA_RESULT_TYPE,
  COLLABORATOR_COLUMN_TYPES,
  DATE_COLUMN_OPTIONS
} from 'dtable-utils';
import {
  DTableSearchInput,
  DTableCustomizeSelect,
  DepartmentSelectFilter,
} from 'dtable-ui-component';
import { isCheckboxColumn } from '../dataset-utils';
import CollaboratorFilter from './CollaboratorFilter';
import FilterItemUtils from './filter-item-utils';
import {
  getFilterByColumn,
  getUpdatedFilterBySelectSingle,
  getUpdatedFilterBySelectMultiple,
  getUpdatedFilterByCreator,
  getUpdatedFilterByCollaborator,
  getColumnOptions,
  getUpdatedFilterByPredicate,
} from './filters-utils';
import RateItem from './rate-item';
import FilterCalendar from './filter-calendar';
import { gettext, mediaUrl } from '../../../../../utils/constants';
import CheckboxEditor from '../../../../../components-form/cell-editor/checkbox-editor';

const propTypes = {
  errMsg: PropTypes.string,
  index: PropTypes.number.isRequired,
  filter: PropTypes.object.isRequired,
  filterColumn: PropTypes.object.isRequired,
  filterConjunction: PropTypes.string.isRequired,
  conjunctionOptions: PropTypes.array.isRequired,
  filterColumnOptions: PropTypes.array.isRequired,
  value: PropTypes.object,
  deleteFilter: PropTypes.func.isRequired,
  updateFilter: PropTypes.func.isRequired,
  updateConjunction: PropTypes.func.isRequired,
  collaborators: PropTypes.array,
  departments: PropTypes.array,
};

const EMPTY_PREDICATE = [FILTER_PREDICATE_TYPE.EMPTY, FILTER_PREDICATE_TYPE.NOT_EMPTY];

const { userDepartmentIdsMap } = window.shared.pageOptions;

class FilterItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      filterTerm: props.filter.filter_term,
      enterRateItemIndex: 0,
    };
    this.filterPredicateOptions = null;
    this.filterTermModifierOptions = null;
    this.invalidFilterTip = React.createRef();

    this.initSelectOptions(props);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { filter } = this.props;
    if (nextProps.filter !== filter) {
      this.initSelectOptions(nextProps);
      this.setState({
        filterTerm: nextProps.filter.filter_term,
      });
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    const currentProps = this.props;
    const shouldUpdated = (
      nextState.enterRateItemIndex !== this.state.enterRateItemIndex ||
      nextProps.index !== currentProps.index ||
      nextProps.filter !== currentProps.filter ||
      nextProps.filterColumn !== currentProps.filterColumn ||
      nextProps.filterConjunction !== currentProps.filterConjunction ||
      nextProps.conjunctionOptions !== currentProps.conjunctionOptions ||
      nextProps.filterColumnOptions !== currentProps.filterColumnOptions
    );
    return shouldUpdated;
  }

  initSelectOptions = (props) => {
    const { filter, filterColumn, value } = props;
    let { filterPredicateList, filterTermModifierList } = getColumnOptions(filterColumn, value);

    // The value of the calculation formula column does not exist in the shared view
    this.filterPredicateOptions = filterPredicateList ? filterPredicateList.map(predicate => {
      return FilterItemUtils.generatorPredicateOption(predicate);
    }) : [];

    const { filter_predicate } = filter;
    if (isDateColumn(filterColumn)) {
      if (filter_predicate === FILTER_PREDICATE_TYPE.IS_WITHIN) {
        filterTermModifierList = filterTermModifierIsWithin;
      }
      this.filterTermModifierOptions = filterTermModifierList.map(termModifier => {
        return FilterItemUtils.generatorTermModifierOption(termModifier);
      });
    }
  };

  onDeleteFilter = (event) => {
    event.nativeEvent.stopImmediatePropagation();
    const { index } = this.props;
    this.props.deleteFilter(index);
  };

  resetState = (filter) => {
    this.setState({ filterTerm: filter.filter_term });
  };

  onSelectConjunction = (value) => {
    const { filterConjunction } = this.props;
    if (filterConjunction === value.filterConjunction) {
      return;
    }
    this.props.updateConjunction(value.filterConjunction);
  };

  onSelectColumn = (value) => {
    const { index, filter, value: dtableValue } = this.props;
    const { column } = value;
    if (column.key === filter.column_key) return;

    let newFilter = getFilterByColumn(column, dtableValue, filter);
    if (!newFilter) return;

    this.resetState(newFilter);
    this.props.updateFilter(index, newFilter);
  };

  onSelectPredicate = (value) => {
    const { index, filter, filterColumn } = this.props;
    const { filterPredicate } = value;
    if (filter.filter_predicate === filterPredicate) {
      return;
    }
    let newFilter = getUpdatedFilterByPredicate(filter, filterColumn, filterPredicate);
    this.resetState(newFilter);
    this.props.updateFilter(index, newFilter);
  };

  onSelectTermModifier = (value) => {
    const { index, filter } = this.props;
    const { filterTermModifier } = value;
    const inputRangeLabel = [
      FILTER_TERM_MODIFIER_TYPE.EXACT_DATE,
      FILTER_TERM_MODIFIER_TYPE.NUMBER_OF_DAYS_AGO,
      FILTER_TERM_MODIFIER_TYPE.NUMBER_OF_DAYS_FROM_NOW,
      FILTER_TERM_MODIFIER_TYPE.THE_NEXT_NUMBERS_OF_DAYS,
      FILTER_TERM_MODIFIER_TYPE.THE_PAST_NUMBERS_OF_DAYS
    ];
    if (filter.filter_term_modifier === filterTermModifier) {
      return;
    }
    let filter_term = filter.filter_term;
    if (inputRangeLabel.indexOf(filter.filter_term_modifier) > -1) {
      filter_term = '';
    }
    let newFilter = Object.assign({}, filter, { filter_term_modifier: filterTermModifier, filter_term });
    this.resetState(newFilter);
    this.props.updateFilter(index, newFilter);
  };

  onSelectSingle = (value) => {
    const { index, filter } = this.props;
    const { columnOption: option } = value;
    if (filter.filter_term === option.id) {
      return;
    }

    let newFilter = getUpdatedFilterBySelectSingle(filter, option);
    this.resetState(newFilter);
    this.props.updateFilter(index, newFilter);
  };

  onSelectMultiple = (value) => {
    const { index, filter } = this.props;
    const { columnOption: option } = value;

    let newFilter = getUpdatedFilterBySelectMultiple(filter, option);
    this.resetState(newFilter);
    this.props.updateFilter(index, newFilter);
  };

  onSelectCollaborator = (value) => {
    const { index, filter } = this.props;
    const { columnOption: collaborator } = value;
    let newFilter = getUpdatedFilterByCollaborator(filter, collaborator);
    this.resetState(newFilter);
    this.props.updateFilter(index, newFilter);
  };

  onSelectCreator = (value) => {
    const { index, filter } = this.props;
    const { columnOption: collaborator } = value;
    let newFilter = getUpdatedFilterByCreator(filter, collaborator);
    // the predicate is 'is' or 'is not'
    if (!newFilter) {
      return;
    }
    this.resetState(newFilter);
    this.props.updateFilter(index, newFilter);

  };

  onFilterTermCheckboxChanged = (value) => {
    const { filterColumn } = this.props;
    const checked = value[filterColumn.key];
    this.onFilterTermChanged(checked);
  };

  onFilterTermTextChanged = (value) => {
    this.onFilterTermChanged(value);
  };

  onFilterTermChanged = (newFilterTerm) => {
    const { index, filter } = this.props;
    const { filterTerm } = this.state;
    if (newFilterTerm !== filterTerm) {
      this.setState({ filterTerm: newFilterTerm });
      let newFilter = Object.assign({}, filter, { filter_term: newFilterTerm });
      this.props.updateFilter(index, newFilter);
    }
  };

  onMouseEnterRateItem = (index) => {
    this.setState({ enterRateItemIndex: index });
  };

  onMouseLeaveRateItem = () => {
    this.setState({ enterRateItemIndex: 0 });
  };

  onChangeRateNumber = (index) => {
    this.onFilterTermChanged(index);
  };

  getInputComponent = (type) => {
    const { filterTerm } = this.state;
    const { filterColumn } = this.props;
    if (type === 'text') {
      return (
        <DTableSearchInput
          value={filterTerm}
          onChange={this.onFilterTermTextChanged}
          autoFocus={false}
          className={classnames('text-truncate')}
        />
      );
    } else if (type === 'checkbox') {
      return (
        <div className='filter-item-checkbox'>
          <CheckboxEditor
            value={filterTerm}
            onCommit={this.onFilterTermCheckboxChanged}
            column={filterColumn}
            isShowCheckboxBorder={true}
          />
        </div>
      );
    }
  };

  renderConjunction = () => {
    const { index, filterConjunction, conjunctionOptions } = this.props;
    switch (index) {
      case 0: {
        return null;
      }
      case 1: {
        const activeConjunction = FilterItemUtils.getActiveConjunctionOption(filterConjunction);
        return (
          <DTableCustomizeSelect
            value={activeConjunction}
            options={conjunctionOptions}
            onSelectOption={this.onSelectConjunction}
          />
        );
      }
      default: {
        return (
          <span className="selected-conjunction-show">{gettext(filterConjunction)}</span>
        );
      }
    }

  };

  renderMultipleSelectOption = (options = [], filterTerm) => {
    const { filter } = this.props;
    const { filter_predicate } = filter;
    let isSupportMultipleSelect = false;
    // The first two options are used for single selection, and the last four options are used for multiple selection
    const supportMultipleSelectOptions = [
      FILTER_PREDICATE_TYPE.IS_ANY_OF,
      FILTER_PREDICATE_TYPE.IS_NONE_OF,
      FILTER_PREDICATE_TYPE.HAS_ANY_OF,
      FILTER_PREDICATE_TYPE.HAS_ALL_OF,
      FILTER_PREDICATE_TYPE.HAS_NONE_OF,
      FILTER_PREDICATE_TYPE.IS_EXACTLY
    ];
    if (supportMultipleSelectOptions.includes(filter_predicate)) {
      isSupportMultipleSelect = true;
    }
    const className = 'select-option-name multiple-select-option';
    let labelArray = [];
    if (Array.isArray(options) && Array.isArray(filterTerm)) {
      filterTerm.forEach((item) => {
        let inOption = options.find(option => option.id === item);
        if (inOption) {
          let optionStyle = {
            margin: '0 10px 0 0',
            background: inOption.color,
            color: inOption.textColor || null,
          };
          labelArray.push(
            <span className={className} style={optionStyle} key={'option_' + item} title={inOption.name} aria-label={inOption.name}>
              {inOption.name}
            </span>
          );
        }
      });
    }
    const selectedOptionNames = labelArray.length > 0 ? { label: (<Fragment>{labelArray}</Fragment>) } : {};

    const dataOptions = options.map(option => {
      return FilterItemUtils.generatorMultipleSelectOption(option, filterTerm);
    });
    return (
      <DTableCustomizeSelect
        className="selector-multiple-select"
        value={selectedOptionNames}
        options={dataOptions}
        onSelectOption={this.onSelectMultiple}
        placeholder={gettext('Select option(s)')}
        searchable={true}
        searchPlaceholder={gettext('Search option')}
        noOptionsPlaceholder={gettext('No options available')}
        supportMultipleSelect={isSupportMultipleSelect}
      />
    );
  };

  renderFilterTerm = (filterColumn) => {
    const { index, filter, collaborators } = this.props;
    const { type } = filterColumn;
    const { filter_term, filter_predicate, filter_term_modifier } = filter;
    // predicate is empty or not empty
    if (EMPTY_PREDICATE.includes(filter_predicate)) {
      return null;
    }

    // the cell value will be date
    // 1. DATE
    // 2. CTIME: create-time
    // 3. MTIME: modify-time
    // 4. FORMULA: result_type is date
    if (isDateColumn(filterColumn)) {
      const inputRangeLabel = [
        FILTER_TERM_MODIFIER_TYPE.EXACT_DATE,
        FILTER_TERM_MODIFIER_TYPE.NUMBER_OF_DAYS_AGO,
        FILTER_TERM_MODIFIER_TYPE.NUMBER_OF_DAYS_FROM_NOW,
        FILTER_TERM_MODIFIER_TYPE.THE_NEXT_NUMBERS_OF_DAYS,
        FILTER_TERM_MODIFIER_TYPE.THE_PAST_NUMBERS_OF_DAYS
      ];
      if (inputRangeLabel.indexOf(filter_term_modifier) > -1) {
        if (filter_term_modifier === 'exact_date') {
          return (
            <FilterCalendar
              onChange={this.onFilterTermTextChanged}
              value={this.state.filterTerm}
              filterColumn={filterColumn}
            />
          );
        }
        return this.getInputComponent('text');
      }
      return null;
    }

    switch (type) {
      case CellType.TEXT:
      case CellType.LONG_TEXT:
      case CellType.GEOLOCATION:
      case CellType.NUMBER:
      case CellType.AUTO_NUMBER:
      case CellType.DURATION:
      case CellType.EMAIL: { // The data in the formula column is a date type that has been excluded
        if (filter_predicate === FILTER_PREDICATE_TYPE.IS_CURRENT_USER_ID) {
          return null;
        }
        return this.getInputComponent('text');
      }
      case CellType.CHECKBOX: {
        return this.getInputComponent('checkbox');
      }
      case CellType.SINGLE_SELECT: {
        // get options
        let { options = [] } = filterColumn.data || {};
        if ([FILTER_PREDICATE_TYPE.IS_ANY_OF, FILTER_PREDICATE_TYPE.IS_NONE_OF].includes(filter_predicate)) {
          return this.renderMultipleSelectOption(options, filter_term);
        }
        let selectedOption = options.find(option => option.id === filter_term);
        let selectedOptionName = {};
        if (selectedOption) {
          const className = 'select-option-name single-select-option';
          const style = { background: selectedOption.color, color: selectedOption.textColor || null };
          selectedOptionName = { label: <span className={className} style={style} title={selectedOption.name} aria-label={selectedOption.name}>{selectedOption.name}</span> };
        }

        let dataOptions = options.map(option => {
          return FilterItemUtils.generatorSingleSelectOption(option);
        });
        return (
          <DTableCustomizeSelect
            className="selector-single-select"
            value={selectedOptionName}
            options={dataOptions}
            onSelectOption={this.onSelectSingle}
            placeholder={gettext('Select an option')}
            searchable={true}
            searchPlaceholder={gettext('Search option')}
            noOptionsPlaceholder={gettext('No options available')}
          />
        );
      }
      case CellType.MULTIPLE_SELECT: {
        let { options = [] } = filterColumn.data || {};
        return this.renderMultipleSelectOption(options, filter_term);
      }
      case CellType.DEPARTMENT_SINGLE_SELECT: {
        if ([FILTER_PREDICATE_TYPE.IS_ANY_OF, FILTER_PREDICATE_TYPE.IS_NONE_OF].includes(filter_predicate)) {
          return (
            <DepartmentSelectFilter
              isMultiple={true}
              column={filterColumn}
              value={filter_term || []}
              userDepartmentIdsMap={userDepartmentIdsMap}
              departments={this.props.departments}
              onCommit={this.onSelectMultiple}
            />
          );
        }
        return (
          <DepartmentSelectFilter
            column={filterColumn}
            value={filter_term || ''}
            userDepartmentIdsMap={userDepartmentIdsMap}
            departments={this.props.departments}
            onCommit={this.onSelectSingle}
          />
        );
      }
      case CellType.COLLABORATOR: {
        if (filter_predicate === FILTER_PREDICATE_TYPE.INCLUDE_ME) {
          return null;
        }
        return (
          <CollaboratorFilter
            filterIndex={index}
            filterTerm={filter_term || []}
            filter_predicate={filter_predicate}
            collaborators={collaborators}
            onSelectCollaborator={this.onSelectCollaborator}
          />
        );
      }
      case CellType.CREATOR:
      case CellType.LAST_MODIFIER: {
        if (filter_predicate === FILTER_PREDICATE_TYPE.INCLUDE_ME) {
          return null;
        }
        const creators = collaborators.concat([{
          name: 'anonymous',
          email: 'anonymous',
          avatar_url: `${mediaUrl}avatars/default.png`
        }]);
        return (
          <CollaboratorFilter
            filterIndex={index}
            filterTerm={filter_term || []}
            collaborators={creators}
            onSelectCollaborator={this.onSelectCreator}
          />
        );
      }
      case CellType.RATE: {
        let { rate_max_number } = filterColumn.data || {};
        let rateList = [];
        for (let i = 0; i < rate_max_number; i++) {
          let rateItem = (
            <RateItem
              key={i}
              enterRateItemIndex={this.state.enterRateItemIndex}
              rateItemIndex={i + 1}
              onMouseEnterRateItem={this.onMouseEnterRateItem}
              onMouseLeaveRateItem={this.onMouseLeaveRateItem}
              value={Number(filter_term) || rate_max_number}
              column={filterColumn}
              isShowRateItem={true}
              onChangeRateNumber={this.onChangeRateNumber}
              editable={true}
            />
          );
          rateList.push(rateItem);
        }
        return (
          <div className="filter-rate-list">
            {rateList}
          </div>
        );
      }
      case CellType.FORMULA:
      case CellType.LINK_FORMULA: {
        return this.renderFormulaFilterTerm(filter_predicate, filter_term, index, filterColumn);
      }
      case CellType.LINK: {
        return this.renderLinkFilterTerm(filter_predicate, filter_term, index, filterColumn);
      }
      default: {
        return null;
      }
    }
  };

  renderErrorMessage = () => {
    return (
      <div className="ml-2">
        <span ref={this.invalidFilterTip} className="dtable-font dtable-icon-exclamation-triangle invalid-filter"></span>
        <UncontrolledTooltip
          target={this.invalidFilterTip}
          delay={{ show: 0, hide: 0 }}
          placement='bottom'
          fade={false}
        >
          {gettext('Invalid filter')}
        </UncontrolledTooltip>
      </div>
    );
  };

  renderFormulaFilterTerm = (filterPredicate, filterTerm, index, filterColumn) => {
    const { data } = filterColumn || {};
    const { result_type } = data || {};
    if (filterPredicate === FILTER_PREDICATE_TYPE.IS_CURRENT_USER_ID) {
      return null;
    }
    if (result_type === FORMULA_RESULT_TYPE.ARRAY) {
      return this.renderFilterTermByArrayType(filterPredicate, filterTerm, index, filterColumn);
    }
    return this.getInputComponent('text');
  };

  renderLinkFilterTerm = (filterPredicate, filterTerm, index, filterColumn) => {
    if (filterPredicate === FILTER_PREDICATE_TYPE.IS_CURRENT_USER_ID) {
      return null;
    }
    return this.renderFilterTermByArrayType(filterPredicate, filterTerm, index, filterColumn);
  };

  renderFilterTermByArrayType = (filterPredicate, filterTerm, index, filterColumn) => {
    const { collaborators } = this.props;
    const { data } = filterColumn || {};
    const { array_type, array_data } = data || {};
    if (!array_type) {
      return null;
    }
    const linkedColumn = { type: array_type, data: array_data };
    if (array_type === CellType.SINGLE_SELECT || array_type === CellType.MULTIPLE_SELECT) {
      let { options = [] } = array_data || {};
      return this.renderMultipleSelectOption(options, filterTerm);
    }
    if (DATE_COLUMN_OPTIONS.includes(array_type) ||
      array_type === CellType.RATE ||
      array_type === CellType.CHECKBOX
    ) {
      return this.renderFilterTerm(linkedColumn);
    }
    if (COLLABORATOR_COLUMN_TYPES.includes(array_type)) {
      if (filterPredicate === FILTER_PREDICATE_TYPE.INCLUDE_ME) {
        return null;
      }
      return (
        <CollaboratorFilter
          filterIndex={index}
          filterTerm={filterTerm || []}
          collaborators={collaborators}
          onSelectCollaborator={this.onSelectCollaborator}
          placeholder={gettext('Add collaborator')}
        />
      );
    }
    return this.getInputComponent('text');
  };

  render() {
    const { filterPredicateOptions, filterTermModifierOptions } = this;
    const { filter, filterColumn, filterColumnOptions, errMsg } = this.props;
    const { filter_predicate, filter_term_modifier } = filter;
    const activeColumn = FilterItemUtils.generatorColumnOption(filterColumn);
    const activePredicate = FilterItemUtils.generatorPredicateOption(filter_predicate);
    let activeTermModifier = null;
    let _isCheckboxColumn = false;
    if (isDateColumn(filterColumn)) {
      activeTermModifier = FilterItemUtils.generatorTermModifierOption(filter_term_modifier);
    } else if (isCheckboxColumn(filterColumn)) {
      _isCheckboxColumn = true;
    }

    // current predicate is not empty
    const isNeedShowTermModifier = !EMPTY_PREDICATE.includes(filter_predicate);

    return (
      <div className="filter-item">
        <div className="delete-filter" onClick={this.onDeleteFilter}>
          <i className="dtable-font dtable-icon-fork-number"></i>
        </div>
        <div className="condition">
          <div className="filter-conjunction">
            {this.renderConjunction()}
          </div>
          <div className="filter-container">
            <div className="filter-column">
              <DTableCustomizeSelect
                value={activeColumn}
                options={filterColumnOptions}
                onSelectOption={this.onSelectColumn}
              />
            </div>
            <div className={`filter-predicate ml-2 ${_isCheckboxColumn ? 'filter-checkbox-predicate' : ''}`}>
              <DTableCustomizeSelect
                value={activePredicate}
                options={filterPredicateOptions}
                onSelectOption={this.onSelectPredicate}
              />
            </div>
            {isDateColumn(filterColumn) && isNeedShowTermModifier && (
              <div className="filter-term-modifier ml-2">
                <DTableCustomizeSelect
                  value={activeTermModifier}
                  options={filterTermModifierOptions}
                  onSelectOption={this.onSelectTermModifier}
                />
              </div>
            )}
            <div className="filter-term ml-2">
              {this.renderFilterTerm(filterColumn)}
            </div>
            {errMsg && this.renderErrorMessage()}
          </div>
        </div>
      </div>
    );
  }
}

FilterItem.propTypes = propTypes;

export default FilterItem;
