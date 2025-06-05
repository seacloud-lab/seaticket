import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { FILTER_COLUMN_OPTIONS, getValidFilters } from 'dtable-utils';
import isHotkey from 'is-hotkey';
import CommonAddTool from '../../../../components/common-add-tool';
import { UncontrolledPopover } from 'reactstrap';
import FiltersList from './filters-widgets/filters-list';
import { getFilterByColumn } from './filters-widgets/filters-utils';
import { gettext } from '../../../../utils/constants';

import '../../css/filters-popover.css';

const propTypes = {
  isLocked: PropTypes.bool,
  columns: PropTypes.array.isRequired,
  departments: PropTypes.array,
  filterConjunction: PropTypes.string,
  filters: PropTypes.array,
  update: PropTypes.func,
  value: PropTypes.object,
  collaborators: PropTypes.array,
  placement: PropTypes.string,
  target: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  hideFilterPopover: PropTypes.func,
};

/**
 * filter data structure
 * let filter = {
 *  column_key: '',
 *  filter_predicate: '',
 *  filter_term: '',
 *  filter_term_modifier: '',
 * }
 */
class FiltersPopover extends Component {

  constructor(props) {
    super(props);
    this.state = {
      filters: getValidFilters(props.filters, props.columns, props.value),
      filterConjunction: props.filterConjunction || 'And',
    };
  }

  componentDidMount() {
    document.addEventListener('click', this.hideDTablePopover, true);
    document.addEventListener('keydown', this.onHotKey);
    window.addEventListener('popstate', this.onHistoryState);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.hideDTablePopover, true);
    document.removeEventListener('keydown', this.onHotKey);
    window.removeEventListener('popstate', this.onHistoryState);
  }

  onHistoryState = (e) => {
    e.preventDefault();
    this.props.hideFilterPopover(e);
  };

  onHotKey = (e) => {
    if (isHotkey('esc', e)) {
      e.preventDefault();
      this.props.hideFilterPopover();
    }
  };

  hideDTablePopover = (e) => {
    if (this.dtablePopoverRef && e && typeof e.target.className === 'string' && e.target.className.indexOf('popover') === -1 && !this.dtablePopoverRef.contains(e.target)) {
      this.props.hideFilterPopover(e);
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };

  update = (filters) => {
    this.setState({ filters }, () => {
      const update = { filters, filter_conjunction: this.state.filterConjunction };
      this.props.update(update);
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

  updateFilterConjunction = (conjunction) => {
    this.setState({ filterConjunction: conjunction }, () => {
      const update = { filters: this.state.filters, filter_conjunction: conjunction };
      this.props.update(update);
    });
  };

  addFilter = (scheduleUpdate) => {
    let { columns, value } = this.props;
    let defaultColumn = columns[0];
    if (!FILTER_COLUMN_OPTIONS[defaultColumn.type]) {
      defaultColumn = columns.find((c) => FILTER_COLUMN_OPTIONS[c.type]);
    }
    if (!defaultColumn) return;
    let filter = getFilterByColumn(defaultColumn, value);
    const filters = this.state.filters.slice(0);
    if (filters.length === 0) {
      scheduleUpdate();
    }
    filters.push(filter);
    this.update(filters);
  };

  onPopoverInsideClick = (e) => {
    e.stopPropagation();
  };

  render() {
    const { columns, target, placement, departments } = this.props;
    const { filters, filterConjunction } = this.state;
    const canAddFilter = columns.length > 0;
    return (
      <UncontrolledPopover
        placement={placement || 'auto-start'}
        isOpen={true}
        target={target || 'dtable-filter-popover'}
        fade={false}
        hideArrow={true}
        className="filter-popover common"
        boundariesElement={document.body}
      >
        {({ update: scheduleUpdate }) => (
          <div ref={ref => this.dtablePopoverRef = ref} onClick={this.onPopoverInsideClick}>
            <FiltersList
              filterConjunction={filterConjunction}
              filters={filters}
              columns={columns}
              departments={departments}
              emptyPlaceholder={gettext('No filters')}
              updateFilter={this.updateFilter}
              deleteFilter={this.deleteFilter}
              updateFilterConjunction={this.updateFilterConjunction}
              collaborators={this.props.collaborators}
              scheduleUpdate={scheduleUpdate}
              readOnly={false}
            />
            <CommonAddTool
              callBack={canAddFilter ? () => this.addFilter(scheduleUpdate) : () => {}}
              footerName={gettext('Add filter')}
              className={canAddFilter ? '' : 'disabled'}
            />
          </div>
        )}
      </UncontrolledPopover>
    );
  }
}

FiltersPopover.propTypes = propTypes;

export default FiltersPopover;
