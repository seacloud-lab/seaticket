import React, { Component } from 'react';
import { FormGroup, Label, UncontrolledPopover } from 'reactstrap';
import classnames from 'classnames';
import deepcopy from 'deep-copy';
import isHotkey from 'is-hotkey';
import PropTypes from 'prop-types';
import CustomizeButton from '@/components/btn/customize-button';
import { gettext } from '@/constants';
import context from '@/sea-metadata/context';
import { getEventClassName } from '@/utils/dom';
import ObjectUtils from '@/utils/object-utils';
import { EVENT_BUS_TYPE, FILTER_COLUMN_OPTIONS } from '../../../constants';
import { getValidFilters, getFilterByColumn } from '../../../utils/filter';
import AdvancedFilters from './advanced-filters';
import BasicFilters from './basic-filters';

import './index.css';

/**
 * filter = {
 *  column_key: '',
 *  filter_predicate: '',
 *  filter_term: '',
 *  filter_term_modifier: '',
 * }
 */
class FilterPopover extends Component {

  constructor(props) {
    super(props);
    const initData = {
      basicFilters: props.basicFilters,
      filters: getValidFilters(props.filters, props.columns),
      filterConjunction: props.filterConjunction || 'And',
    };

    this.initData = deepcopy(initData);
    this.state = {
      basicFilters: initData.basicFilters,
      filters: initData.filters,
      filterConjunction: initData.filterConjunction,
    };
    this.isSelectOpen = false;
    this.popoverInnerRef = null;
    this.filtersContainerRef = null;
  }

  componentDidMount() {
    this.popoverInnerRef && this.popoverInnerRef.click();
    document.addEventListener('click', this.hidePopoverByClick, true);
    document.addEventListener('keydown', this.onHotKey);
    this.unsubscribeOpenSelect = context.eventBus.subscribe(EVENT_BUS_TYPE.OPEN_SELECT, this.setSelectStatus);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.hidePopoverByClick, true);
    document.removeEventListener('keydown', this.onHotKey);
    this.unsubscribeOpenSelect();
  }

  onClosePopover = () => {
    const { readOnly, columns } = this.props;
    const { filters, filterConjunction, basicFilters } = this.state;
    const isChanged = !ObjectUtils.isSameObject(this.initData, {
      ...this.state,
      filters: getValidFilters(filters, columns)
    });
    if (!readOnly && isChanged) {
      const update = { filters, filter_conjunction: filterConjunction, basic_filters: basicFilters };
      this.props.update(update);
    }
    this.props.hidePopover();
  };

  onHotKey = (e) => {
    if (isHotkey('esc', e) && !this.isSelectOpen) {
      e.preventDefault();
      this.onClosePopover();
    }
  };

  setSelectStatus = (status) => {
    this.isSelectOpen = status;
  };

  hidePopoverByClick = (e) => {
    if (document.getElementsByClassName('sea-metadata-data-filter-popover').length > 0) return;
    if (document.getElementsByClassName('seaqa-select-options-container').length > 0) return;
    if (this.popoverInnerRef && !getEventClassName(e).includes('popover') && !this.popoverInnerRef.contains(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      this.onClosePopover();
      return false;
    }
  };

  update = (filters, isAddFilter = false) => {
    this.setState({ filters }, () => {
      if (!isAddFilter) return;
      if (!this.filtersContainerRef) return;
      this.filtersContainerRef.scrollTo({ top: this.filtersContainerRef.scrollHeight, behavior: 'smooth' });
    });
  };

  deleteFilter = (filterIndex, scheduleUpdate) => {
    const filters = this.state.filters.slice(0);
    filters.splice(filterIndex, 1);
    if (filters.length === 0) {
      scheduleUpdate();
    }
    this.update(filters);
  };

  updateFilter = (filterIndex, updated) => {
    const filters = this.state.filters.slice(0);
    filters[filterIndex] = updated;
    this.update(filters);
  };

  modifyFilterConjunction = (conjunction) => {
    this.setState({ filterConjunction: conjunction });
  };

  addFilter = (scheduleUpdate) => {
    let { columns } = this.props;
    let defaultColumn = columns[0];
    if (!FILTER_COLUMN_OPTIONS[defaultColumn.type]) {
      defaultColumn = columns.find((c) => FILTER_COLUMN_OPTIONS[c.type]);
    }
    if (!defaultColumn) return;
    let filter = getFilterByColumn(defaultColumn);
    const filters = this.state.filters.slice(0);
    if (filters.length === 0) {
      scheduleUpdate();
    }
    filters.push(filter);
    this.update(filters, true);
  };

  onPopoverInsideClick = (e) => {
    e.stopPropagation();
  };

  onBasicFilterChange = (value) => {
    this.setState({ basicFilters: value });
  };

  render() {
    const { readOnly, target, columns, placement = 'auto-start', viewType } = this.props;
    const { filters, filterConjunction, basicFilters } = this.state;
    const canAddFilter = columns.length > 0;
    const advancedFilterColumns = columns.filter(c => !basicFilters.find(basicFilter => basicFilter.column_key === c.key));
    const isValidBasicFilters = basicFilters.length > 0;

    return (
      <UncontrolledPopover
        placement={placement}
        isOpen={true}
        target={target}
        fade={false}
        hideArrow={true}
        className={classnames('sea-metadata-filter-popover', { 'disabled': readOnly })}
        boundariesElement={document.body}
      >
        {({ update: scheduleUpdate }) => (
          <div
            ref={ref => this.popoverInnerRef = ref}
            onClick={this.onPopoverInsideClick}
            className="sea-metadata-filters"
          >
            <div className="sea-metadata-filters-container" ref={ref => this.filtersContainerRef = ref}>
              {isValidBasicFilters && (
                <BasicFilters readOnly={readOnly} columns={columns} filters={basicFilters} onChange={this.onBasicFilterChange} viewType={viewType}/>
              )}
              <FormGroup className="filter-group-advanced filter-group px-4 mb-0">
                {isValidBasicFilters && (
                  <Label className="filter-group-name mb-3">{gettext('Advanced')}</Label>
                )}
                <div className={classnames('filter-group-container', { 'pt-4': !isValidBasicFilters })}>
                  <AdvancedFilters
                    filterConjunction={filterConjunction}
                    filters={filters}
                    columns={advancedFilterColumns}
                    emptyPlaceholder={gettext('No filters')}
                    updateFilter={this.updateFilter}
                    deleteFilter={this.deleteFilter}
                    modifyFilterConjunction={this.modifyFilterConjunction}
                    collaborators={this.props.collaborators}
                    typesData={this.props.typesData}
                    tagsData={this.props.tagsData}
                    readOnly={readOnly}
                    scheduleUpdate={scheduleUpdate}
                    isPre={this.props.isPre}
                  />
                </div>
              </FormGroup>
            </div>
            {!readOnly && (
              <div className="sea-metadata-filter-popover-add-btns">
                <CustomizeButton
                  className="popover-add-tool"
                  callBack={() => this.addFilter(scheduleUpdate)}
                  disabled={!canAddFilter}
                  name={gettext('Add filter')}
                />
              </div>
            )}
          </div>
        )}
      </UncontrolledPopover>
    );
  }
}

FilterPopover.propTypes = {
  placement: PropTypes.string,
  filtersClassName: PropTypes.string,
  target: PropTypes.string.isRequired,
  readOnly: PropTypes.bool,
  columns: PropTypes.array.isRequired,
  filterConjunction: PropTypes.string,
  filters: PropTypes.array,
  collaborators: PropTypes.array,
  isPre: PropTypes.bool,
  basicFilters: PropTypes.array,
  hidePopover: PropTypes.func,
  update: PropTypes.func,
  viewType: PropTypes.string,
};

export default FilterPopover;
