import React from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import {
  Tooltip,
  CustomizeSelect,
  SearchInput,
  IconButton,
} from '@/components';
import SelectTrigger from '@/components/customize-select/select-trigger';
import { gettext } from '@/constants';
import { ColumnSelector, OptionSelector, CollaboratorSelector, PrioritySelector } from '@/sea-metadata/components/selectors';
import {
  CellType, FILTER_PREDICATE_TYPE, FILTER_TERM_MODIFIER_TYPE, FILTER_ERR_MSG,
  filterTermModifierIsWithin, FILTER_CONJUNCTION_TYPES,
} from '../../../../../constants';
import {
  isCheckboxColumn, isDateColumn, getColumnOptions as getSelectColumnOptions,
  getTypesOptions, getColumnByKey,
} from '../../../../../utils/column';
import {
  getFilterByColumn, getColumnOptions, getUpdatedFilterByPredicate,
} from '../../../../../utils/filter';
import UnreadStatusFormatter from '../../../../cell-formatter/unread-status';
import FilterCalendar from '../filter-calendar';
import FilterItemUtils from '../filter-item-utils';
import TagsFilter from './tags-filter';

import './index.css';

const propTypes = {
  readOnly: PropTypes.bool,
  index: PropTypes.number.isRequired,
  filter: PropTypes.object.isRequired,
  filterColumn: PropTypes.object.isRequired,
  filterConjunction: PropTypes.string.isRequired,
  value: PropTypes.object,
  deleteFilter: PropTypes.func.isRequired,
  updateFilter: PropTypes.func.isRequired,
  updateConjunction: PropTypes.func.isRequired,
  collaborators: PropTypes.array,
  errMsg: PropTypes.string,
};

const EMPTY_PREDICATE = [FILTER_PREDICATE_TYPE.EMPTY, FILTER_PREDICATE_TYPE.NOT_EMPTY];

class FilterItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      filterTerm: props.filter.filter_term,
    };
    this.filterPredicateOptions = null;
    this.filterTermModifierOptions = null;

    this.filterToolTip = React.createRef();
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
      nextProps.index !== currentProps.index ||
      nextProps.filter !== currentProps.filter ||
      nextProps.filterColumn !== currentProps.filterColumn ||
      nextProps.filterConjunction !== currentProps.filterConjunction
    );
    return shouldUpdated;
  }

  initSelectOptions = (props) => {
    const { filter, filterColumn, value } = props;
    let { filterPredicateList, filterTermModifierList } = getColumnOptions(filterColumn, value);
    this.filterPredicateOptions = filterPredicateList ? filterPredicateList.map(predicate => {
      return FilterItemUtils.generatorPredicateOption(predicate);
    }).filter(item => item) : [];

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

  onSelectConjunction = (newValue) => {
    const { filterConjunction } = this.props;
    if (filterConjunction === newValue) {
      return;
    }
    this.props.updateConjunction(newValue);
  };

  onSelectColumn = (newColumnKey) => {
    const { index, filter, filterColumns } = this.props;
    if (newColumnKey === filter.column_key) return;
    const newColumn = getColumnByKey(filterColumns, newColumnKey);
    const newFilter = getFilterByColumn(newColumn, filter);
    if (!newFilter) return;

    this.resetState(newFilter);
    this.props.updateFilter(index, newFilter);
  };

  onSelectPredicate = (newFilterPredicate) => {
    const { index, filter, filterColumn } = this.props;
    if (filter.filter_predicate === newFilterPredicate) return;
    let newFilter = getUpdatedFilterByPredicate(filter, filterColumn, newFilterPredicate);
    this.resetState(newFilter);
    this.props.updateFilter(index, newFilter);
  };

  onSelectTermModifier = (newFilterTermModifier) => {
    const { index, filter } = this.props;
    const inputRangeLabel = [
      FILTER_TERM_MODIFIER_TYPE.EXACT_DATE,
      FILTER_TERM_MODIFIER_TYPE.NUMBER_OF_DAYS_AGO,
      FILTER_TERM_MODIFIER_TYPE.NUMBER_OF_DAYS_FROM_NOW,
      FILTER_TERM_MODIFIER_TYPE.THE_NEXT_NUMBERS_OF_DAYS,
      FILTER_TERM_MODIFIER_TYPE.THE_PAST_NUMBERS_OF_DAYS
    ];
    if (filter.filter_term_modifier === newFilterTermModifier) return;
    let filter_term = filter.filter_term;
    if (inputRangeLabel.indexOf(filter.filter_term_modifier) > -1) {
      filter_term = '';
    }
    let newFilter = Object.assign({}, filter, { filter_term_modifier: newFilterTermModifier, filter_term });
    this.resetState(newFilter);
    this.props.updateFilter(index, newFilter);
  };

  onFilterTermChanged = (newFilterTerm) => {
    const { index, filter, readOnly } = this.props;
    if (readOnly) return;
    const { filterTerm } = this.state;
    if (newFilterTerm === filterTerm) return;
    this.setState({ filterTerm: newFilterTerm });
    const newFilter = Object.assign({}, filter, { filter_term: newFilterTerm });
    this.props.updateFilter(index, newFilter);
  };

  onFilterTermNumberChanged = () => {
    const value = this.numberEditor.getValue();
    this.onFilterTermChanged(Object.values(value)[0]);
  };

  getInputComponent = (type) => {
    const { readOnly } = this.props;
    const { filterTerm } = this.state;
    if (type === 'text') {
      return (
        <SearchInput
          isShowSearchIcon={false}
          value={filterTerm}
          inputClassName="sea-metadata-filter-input"
          onChange={this.onFilterTermChanged}
          autoFocus={false}
          disabled={readOnly}
          className='text-truncate'
          inputStyle={{ padding: '0 16px' }}
        />
      );
    } else if (type === 'checkbox') {
      const { readOnly } = this.props;
      return (
        <input
          className="sea-metadata-filter-input"
          type="checkbox"
          disabled={readOnly}
          checked={filterTerm}
          onChange={(e) => this.onFilterTermChanged(e.target.checked)}
        />
      );
    }
  };

  renderConjunction = () => {
    const { index, readOnly, filterConjunction } = this.props;
    switch (index) {
      case 0: {
        return null;
      }
      case 1: {
        return (
          <CustomizeSelect
            disabled={readOnly}
            isInModal={true}
            value={filterConjunction}
            containerClassName="sea-metadata-filter-conjunction-select-container"
            options={FILTER_CONJUNCTION_TYPES}
            onChange={this.onSelectConjunction}
          />
        );
      }
      default: {
        const selectedValue = (<span className="selected-option-show">{gettext(filterConjunction)}</span>);
        return (
          <SelectTrigger
            disabled={true}
            className="border-transparent sea-metadata-filter-conjunction-select"
            selectedValue={selectedValue}
          />
        );
      }
    }

  };

  renderFilterTerm = (filterColumn) => {
    const { filter, collaborators, readOnly, typesData, tagsData } = this.props;
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
              readOnly={readOnly}
              onChange={this.onFilterTermChanged}
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
      case CellType.NUMBER:
      case CellType.TEXT:
      case CellType.URL: {
        return this.getInputComponent('text');
      }
      case CellType.CREATOR:
      case CellType.LAST_MODIFIER: {
        if (filter_predicate === FILTER_PREDICATE_TYPE.INCLUDE_ME) return null;
        const isMultiple = ![FILTER_PREDICATE_TYPE.IS, FILTER_PREDICATE_TYPE.IS_NOT].includes(filter_predicate);
        const value = isMultiple ? (filter_term || []) : Array.isArray(filter_term) ? filter_term[0] || '' : '';
        return (
          <CollaboratorSelector
            readOnly={readOnly}
            className="border-radius-4"
            value={value}
            predicate={filter_predicate}
            collaborators={collaborators}
            isCloseSubmit={isMultiple}
            onChange={(value) => {
              const newValue = isMultiple ? value : value ? [value] : [];
              this.onFilterTermChanged(newValue);
            }}
            column={filterColumn}
          />
        );
      }
      case CellType.CHECKBOX: {
        return this.getInputComponent('checkbox');
      }
      case CellType.UNREAD_STATUS: {
        return (
          <div
            className={classnames('sea-metadata-unread-status-filter', { 'disabled': readOnly })}
            onClick={() => this.onFilterTermChanged(Boolean(!filter_term))}
          >
            {filter_term && (
              <UnreadStatusFormatter value={true} />
            )}
          </div>
        );
      }
      case CellType.REPLY_STATUS: {
        return this.getInputComponent('checkbox');
      }
      case CellType.SINGLE_SELECT:
      case CellType.TYPE: {
        const options = type === CellType.SINGLE_SELECT ? getSelectColumnOptions(filterColumn) : getTypesOptions(typesData);
        return (
          <OptionSelector
            className="border-radius-4"
            readOnly={readOnly}
            value={filter_term}
            predicate={filter_predicate}
            options={options}
            column={filterColumn}
            onChange={this.onFilterTermChanged}
          />
        );
      }
      case CellType.COLLABORATOR: {
        if (filter_predicate === FILTER_PREDICATE_TYPE.INCLUDE_ME) return null;
        const allCollaborators = this.props.collaborators;
        return (
          <CollaboratorSelector
            readOnly={readOnly}
            className="border-radius-4"
            value={filter_term || []}
            predicate={filter_predicate}
            collaborators={allCollaborators}
            onChange={this.onFilterTermChanged}
            column={filterColumn}
          />
        );
      }
      case CellType.MULTIPLE_SELECT: {
        const options = getSelectColumnOptions(filterColumn);
        return (
          <OptionSelector
            readOnly={readOnly}
            className="border-radius-4"
            value={filter_term}
            predicate={filter_predicate}
            options={options}
            column={filterColumn}
            onChange={this.onFilterTermChanged}
          />
        );
      }
      case CellType.TAGS: {
        return (
          <TagsFilter
            readOnly={readOnly}
            className="border-radius-4"
            value={filter_term}
            predicate={filter_predicate}
            onChange={this.onFilterTermChanged}
            column={filterColumn}
            tagsData={tagsData}
          />
        );
      }
      case CellType.PRIORITY: {
        return (
          <PrioritySelector
            className="border-radius-4"
            readOnly={readOnly}
            value={Number(filter_term) || 0}
            onChange={this.onFilterTermChanged}
          />
        );
      }
      default: {
        return null;
      }
    }
  };

  isRenderErrorTips = () => {
    const { errMsg } = this.props;
    return errMsg && errMsg !== FILTER_ERR_MSG.INCOMPLETE_FILTER;
  };

  renderTipMessage = () => {
    const { filter, filterColumn } = this.props;
    const { filter_predicate } = filter;
    const isContainPredicate = [CellType.LINK].includes(filterColumn.type) && [FILTER_PREDICATE_TYPE.CONTAINS, FILTER_PREDICATE_TYPE.NOT_CONTAIN].includes(filter_predicate);
    if (!isContainPredicate) return null;
    const isRenderErrorTips = this.isRenderErrorTips();
    if (isRenderErrorTips) return null;
    return (
      <div className="ml-2" >
        <IconButton id={`filter-tool-tip-${filterColumn.key}`} icon="exclamation-triangle-filled" iconStyle={{ color: '#FFC92C' }} />
        <Tooltip placement="bottom" target={`filter-tool-tip-${filterColumn.key}`}>
          {gettext('If there are multiple items in the cell, a random one will be chosen and be compared with the filter value.')}
        </Tooltip>
      </div>
    );
  };

  renderErrorMessage = () => {
    if (!this.isRenderErrorTips()) {
      return null;
    }
    return (
      <div className="ml-2 d-flex align-items-center">
        <div ref={this.invalidFilterTip}>
          <IconButton icon="exclamation-triangle-filled" iconStyle={{ color: '#cd201f' }}/>
        </div>
        <Tooltip target={this.invalidFilterTip} placement="bottom">
          {gettext('Invalid filter')}
        </Tooltip>
      </div>
    );
  };

  render() {
    const { filterPredicateOptions, filterTermModifierOptions } = this;
    const { filter, filterColumn, filterColumns, readOnly } = this.props;
    const { filter_predicate, filter_term_modifier } = filter;
    let _isCheckboxColumn = false;
    if (isCheckboxColumn(filterColumn)) {
      _isCheckboxColumn = true;
    }

    // current predicate is not empty
    const isNeedShowTermModifier = !EMPTY_PREDICATE.includes(filter_predicate);

    return (
      <div className="filter-item">
        {!readOnly && (
          <IconButton icon="close" onClick={this.onDeleteFilter} size={{ btn: 24, icon: 14 }} />
        )}
        <div className="condition">
          <div className="filter-conjunction">
            {this.renderConjunction()}
          </div>
          <div className="filter-container">
            <div className="filter-column">
              <ColumnSelector
                disabled={readOnly}
                value={filterColumn.key}
                columns={filterColumns}
                onChange={this.onSelectColumn}
              />
            </div>
            <div className={`filter-predicate ${_isCheckboxColumn ? 'filter-checkbox-predicate' : ''}`}>
              <CustomizeSelect
                disabled={readOnly}
                isInModal={true}
                containerClassName="sea-metadata-filter-predicate-container"
                value={filter_predicate}
                options={filterPredicateOptions}
                onChange={this.onSelectPredicate}
              />
            </div>
            {isDateColumn(filterColumn) && isNeedShowTermModifier && (
              <div className="filter-term-modifier">
                <CustomizeSelect
                  disabled={readOnly}
                  isInModal={true}
                  containerClassName="sea-metadata-filter-term-modifier-container"
                  value={filter_term_modifier}
                  options={filterTermModifierOptions}
                  onChange={this.onSelectTermModifier}
                />
              </div>
            )}
            <div className="filter-term">
              {this.renderFilterTerm(filterColumn)}
            </div>
            {this.renderTipMessage()}
            {this.renderErrorMessage()}
          </div>
        </div>
      </div>
    );
  }
}

FilterItem.propTypes = propTypes;

export default FilterItem;
