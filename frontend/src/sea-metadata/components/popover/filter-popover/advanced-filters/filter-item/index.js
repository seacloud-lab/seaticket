import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { UncontrolledTooltip } from 'reactstrap';
import CustomizeSelect from '@/components/customize-select';
import SearchInput from '@/components/search-input';
import Icon from '@/components/icon';
import IconBtn from '@/components/icon-button';
import CollaboratorFilter from './collaborator-filter';
import FilterCalendar from '../filter-calendar';
import PriorityItem from '../../../../cell-editors/priority-editor/priority-item';
import PriorityFormatter from '@/sea-metadata/components/cell-formatter/priority';
import { gettext } from '@/constants';
import { isCheckboxColumn, isDateColumn, getColumnOptions as getSelectColumnOptions, getTypesOptions, getTagsOptions } from '../../../../../utils/column';
import {
  getFilterByColumn, getUpdatedFilterBySelectSingle, getUpdatedFilterBySelectMultiple, getUpdatedFilterByCreator, getUpdatedFilterByCollaborator,
  getColumnOptions, getUpdatedFilterByPredicate, getUpdatedFilterBySelectTag,
} from '../../../../../utils/filter';
import {
  CellType, DELETED_OPTION_BACKGROUND_COLOR, DELETED_OPTION_TIPS, FILTER_PREDICATE_TYPE, FILTER_TERM_MODIFIER_TYPE, FILTER_ERR_MSG,
  filterTermModifierIsWithin, PRIORITIES, DELETED_TAG_TIPS,
} from '../../../../../constants';
import FilterItemUtils from '../filter-item-utils';
import context from '@/sea-metadata/context';
import CustomizePopover from '@/components/customize-popover';
import SelectOption from '@/sea-metadata/components/cell-formatter/select-option';
import Tag from '@/sea-metadata/components/tag';
import { getRowById } from '@/sea-metadata/utils/row';

import './index.css';

const propTypes = {
  readOnly: PropTypes.bool,
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
  errMsg: PropTypes.string,
};

const EMPTY_PREDICATE = [FILTER_PREDICATE_TYPE.EMPTY, FILTER_PREDICATE_TYPE.NOT_EMPTY];

class FilterItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      filterTerm: props.filter.filter_term,
      isPriorityFilterOpen: false,
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
      nextProps.filterConjunction !== currentProps.filterConjunction ||
      nextProps.conjunctionOptions !== currentProps.conjunctionOptions ||
      nextProps.filterColumnOptions !== currentProps.filterColumnOptions ||
      nextState.isPriorityFilterOpen !== this.state.isPriorityFilterOpen
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

  onSelectConjunction = (value) => {
    const { filterConjunction } = this.props;
    if (filterConjunction === value.filterConjunction) {
      return;
    }
    this.props.updateConjunction(value.filterConjunction);
  };

  onSelectColumn = (value) => {
    const { index, filter } = this.props;
    const { column } = value;
    if (column.key === filter.column_key) return;

    let newFilter = getFilterByColumn(column, filter);
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

  onSelectTag = (value) => {
    const { index, filter } = this.props;
    const { tag } = value;

    let newFilter = getUpdatedFilterBySelectTag(filter, tag);
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

  onFilterTermCheckboxChanged = (e) => {
    this.onFilterTermChanged(e.target.checked);
  };

  onFilterTermTextChanged = (value) => {
    this.onFilterTermChanged(value);
  };

  onFilterTermNumberChanged = () => {
    const value = this.numberEditor.getValue();
    this.onFilterTermChanged(Object.values(value)[0]);
  };

  onFilterExactDateChanged = (value) => {
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

  onChangePriority = (index) => {
    this.onFilterTermChanged(index);
    this.onPriorityFilterClose();
  };

  getInputComponent = (type) => {
    const { readOnly } = this.props;
    const { filterTerm } = this.state;
    if (type === 'text') {
      return (
        <SearchInput
          isShowSearchIcon={false}
          value={filterTerm}
          onChange={this.onFilterTermTextChanged}
          autoFocus={false}
          disabled={readOnly}
          className='text-truncate'
        />
      );
    } else if (type === 'checkbox') {
      const { readOnly } = this.props;
      return (
        <input
          type="checkbox"
          disabled={readOnly}
          checked={filterTerm}
          onChange={this.onFilterTermCheckboxChanged}
        />
      );
    }
  };

  renderConjunction = () => {
    const { index, readOnly, filterConjunction, conjunctionOptions } = this.props;
    switch (index) {
      case 0: {
        return null;
      }
      case 1: {
        const activeConjunction = FilterItemUtils.getActiveConjunctionOption(filterConjunction);
        return (
          <CustomizeSelect
            disabled={readOnly}
            value={activeConjunction}
            options={conjunctionOptions}
            onChange={this.onSelectConjunction}
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

    let labelArray = [];
    if (Array.isArray(options) && Array.isArray(filterTerm)) {
      filterTerm.forEach((item) => {
        let inOption = options.find(option => option.id === item);
        let option = inOption || { color: DELETED_OPTION_BACKGROUND_COLOR, name: DELETED_OPTION_TIPS };
        labelArray.push(
          <SelectOption option={option} key={'option_' + item} className="select-option-name multiple-select-option" />
        );
      });
    }
    const selectedOptionNames = labelArray.length > 0 ? { label: (<Fragment>{labelArray}</Fragment>) } : {};

    const dataOptions = options.map(option => {
      return FilterItemUtils.generatorMultipleSelectOption(option, filterTerm);
    });
    return (
      <CustomizeSelect
        className="sea-metadata-selector-multiple-select"
        value={selectedOptionNames}
        options={dataOptions}
        onChange={this.onSelectMultiple}
        placeholder={gettext('Select option(s)')}
        searchable={true}
        searchPlaceholder={gettext('Search option')}
        noOptionsPlaceholder={gettext('No options available')}
        supportMultipleSelect={isSupportMultipleSelect}
      />
    );
  };

  renderTagsOption = (filterTerm) => {
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
    const tags = getTagsOptions(this.props.tagsData);

    let labelArray = [];
    if (Array.isArray(tags) && Array.isArray(filterTerm)) {
      filterTerm.forEach((item) => {
        const tag = getRowById(this.props.tagsData, item + '') || { color: DELETED_OPTION_BACKGROUND_COLOR, name: DELETED_TAG_TIPS };
        labelArray.push(
          <Tag className="d-inline-flex" tag={tag} key={'option_' + item} />
        );
      });
    }
    const selectedOptionNames = labelArray.length > 0 ? { label: (<Fragment>{labelArray}</Fragment>) } : {};

    const dataOptions = tags.map(option => {
      return FilterItemUtils.generatorTagOption(option, filterTerm);
    });
    return (
      <CustomizeSelect
        className="sea-metadata-selector-tags-select"
        value={selectedOptionNames}
        options={dataOptions}
        onChange={this.onSelectTag}
        placeholder={gettext('Select tag(s)')}
        searchable={true}
        searchPlaceholder={gettext('Search tag')}
        noOptionsPlaceholder={gettext('No tags available')}
        supportMultipleSelect={isSupportMultipleSelect}
      />
    );
  };

  onPriorityFilterOpen = () => {
    this.setState({ isPriorityFilterOpen: true });
  };

  onPriorityFilterClose = () => {
    this.setState({ isPriorityFilterOpen: false });
  };

  renderFilterTerm = (filterColumn) => {
    const { index, filter, collaborators, readOnly, typesData } = this.props;
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
              readOnly={readOnly}
              onChange={this.onFilterExactDateChanged}
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
        if (filter_predicate === FILTER_PREDICATE_TYPE.INCLUDE_ME) {
          return null;
        }
        const creators = collaborators;
        return (
          <CollaboratorFilter
            readOnly={readOnly}
            filterIndex={index}
            filterTerm={filter_term || []}
            collaborators={creators}
            onSelectCollaborator={this.onSelectCreator}
          />
        );
      }
      case CellType.CHECKBOX: {
        return this.getInputComponent('checkbox');
      }
      case CellType.SINGLE_SELECT:
      case CellType.TYPE: {
        // get options
        const options = type === CellType.SINGLE_SELECT ? getSelectColumnOptions(filterColumn) : getTypesOptions(typesData);
        if ([FILTER_PREDICATE_TYPE.IS_ANY_OF, FILTER_PREDICATE_TYPE.IS_NONE_OF].includes(filter_predicate)) {
          return this.renderMultipleSelectOption(options, filter_term);
        }
        let selectedOptionDom = { label: null };
        if (filter_term) {
          let selectedOption = options.find(option => option.id === filter_term);
          const option = selectedOption || { color: DELETED_OPTION_BACKGROUND_COLOR, name: DELETED_OPTION_TIPS };
          selectedOptionDom = { label: (
            <SelectOption option={option} className="select-option-name single-select-option" />
          ) };
        }

        let dataOptions = options.map(option => {
          return FilterItemUtils.generatorSingleSelectOption(option);
        });

        return (
          <CustomizeSelect
            disabled={readOnly}
            className=" sea-metadata-selector-single-select"
            value={selectedOptionDom}
            options={dataOptions || []}
            onChange={this.onSelectSingle}
            placeholder={gettext('Select an option')}
            searchable={true}
            searchPlaceholder={gettext('Search option')}
            noOptionsPlaceholder={gettext('No options available')}
            isInModal={this.props.isInModal}
          />
        );
      }
      case CellType.COLLABORATOR: {
        if (filter_predicate === FILTER_PREDICATE_TYPE.INCLUDE_ME) return null;
        const allCollaborators = this.props.collaborators;
        return (
          <CollaboratorFilter
            readOnly={readOnly}
            filterIndex={index}
            filterTerm={filter_term || []}
            filter_predicate={filter_predicate}
            collaborators={allCollaborators}
            placeholder={gettext('Select collaborators')}
            onSelectCollaborator={this.onSelectCollaborator}
          />
        );
      }
      case CellType.MULTIPLE_SELECT: {
        let { options = [] } = filterColumn.data || {};
        return this.renderMultipleSelectOption(options, filter_term, readOnly);
      }
      case CellType.TAGS: {
        return this.renderTagsOption(filter_term, readOnly);
      }
      case CellType.PRIORITY: {
        return (
          <div>
            <div className="form-control pr-8 d-flex align-items-center" onClick={this.onPriorityFilterOpen} id={`priority-editor-${filterColumn.key}`} >
              <PriorityFormatter value={Number(filter_term)} showName={true} className={readOnly ? '' : 'cursor-pointer'} />
            </div>
            {this.state.isPriorityFilterOpen && (
              <CustomizePopover
                target={`priority-editor-${filterColumn.key}`}
                className={classnames('sea-metadata-priority-editor-popover-container')}
                hidePopover={this.onPriorityFilterClose}
                hidePopoverWithEsc={this.onPriorityFilterClose}
              >
                <div className="sea-metadata-priority-editor-popover">
                  {PRIORITIES.map((item, index) => (
                    <PriorityItem
                      key={index}
                      value={item.value}
                      hotKey={item.hotKey}
                      onClick={this.onChangePriority}
                      readOnly={false}
                      isSelected={item.value === Number(filter_term)}
                    />
                  ))}
                </div>
              </CustomizePopover>
            )}
          </div>
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
        <IconBtn id={`filter-tool-tip-${filterColumn.key}`} icon="exclamation-triangle-filled" iconStyle={{ color: '#FFC92C' }} />
        <UncontrolledTooltip placement="bottom" target={`filter-tool-tip-${filterColumn.key}`} fade={false} className="sea-metadata-tooltip">
          {gettext('If there are multiple items in the cell, a random one will be chosen and be compared with the filter value.')}
        </UncontrolledTooltip>
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
          <IconBtn icon="exclamation-triangle-filled" iconStyle={{ color: '#cd201f' }}/>
        </div>
        <UncontrolledTooltip
          target={this.invalidFilterTip}
          placement='bottom'
          fade={false}
          className="sea-metadata-tooltip"
        >
          {gettext('Invalid filter')}
        </UncontrolledTooltip>
      </div>
    );
  };

  render() {
    const { filterPredicateOptions, filterTermModifierOptions } = this;
    const { filter, filterColumn, filterColumnOptions, readOnly } = this.props;
    const { filter_predicate, filter_term_modifier } = filter;
    const activeColumn = FilterItemUtils.generatorColumnOption(filterColumn);
    const activePredicate = FilterItemUtils.generatorPredicateOption(filter_predicate, true);
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
        {!readOnly && (
          <div className="delete-filter" onClick={this.onDeleteFilter}>
            <Icon className="sea-metadata-icon" symbol="close"/>
          </div>
        )}
        <div className="condition">
          <div className="filter-conjunction">
            {this.renderConjunction()}
          </div>
          <div className="filter-container">
            <div className="filter-column">
              <CustomizeSelect
                disabled={readOnly}
                value={activeColumn}
                options={filterColumnOptions}
                onChange={this.onSelectColumn}
                searchable={true}
                searchPlaceholder={context.translate('Search {column}')}
                noOptionsPlaceholder={gettext('No results')}
              />
            </div>
            <div className={`filter-predicate ml-2 ${_isCheckboxColumn ? 'filter-checkbox-predicate' : ''}`}>
              <CustomizeSelect
                disabled={readOnly}
                value={activePredicate}
                options={filterPredicateOptions}
                onChange={this.onSelectPredicate}
              />
            </div>
            {isDateColumn(filterColumn) && isNeedShowTermModifier && (
              <div className="filter-term-modifier ml-2">
                <CustomizeSelect
                  disabled={readOnly}
                  value={activeTermModifier}
                  options={filterTermModifierOptions}
                  onChange={this.onSelectTermModifier}
                />
              </div>
            )}
            <div className="filter-term ml-2">
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
