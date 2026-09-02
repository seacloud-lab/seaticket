import React, { Component } from 'react';
import PropTypes from 'prop-types';
import isHotkey from 'is-hotkey';
import { UncontrolledPopover } from 'reactstrap';
import classnames from 'classnames';
import CustomizeAddTool from '@/components/customize-add-tool';
import Icon from '@/components/icon';
import { gettext } from '@/constants';
import { getColumnByKey } from '../../../utils/column';
import { getEventClassName } from '@/utils/dom';
import {
  EVENT_BUS_TYPE, VIEW_SORT_COLUMN_RULES, VIEW_FIRST_SORT_COLUMN_RULES, VIEW_TYPE,
} from '../../../constants';
import { execSortsOperation, getDisplaySorts, isSortsEmpty, SORT_OPERATION } from './utils';
import context from '@/sea-metadata/context';
import ObjectUtils from '@/utils/object-utils';
import { ColumnSelector, SortSelector } from '../../selectors';

import './index.css';

const propTypes = {
  readOnly: PropTypes.bool,
  target: PropTypes.string.isRequired,
  type: PropTypes.string,
  sorts: PropTypes.array,
  columns: PropTypes.array.isRequired,
  hidePopover: PropTypes.func,
  update: PropTypes.func,
};

class SortPopover extends Component {

  constructor(props) {
    super(props);
    const { sorts, columns = [], type } = this.props;
    this.checkColumnEnableFirstSortRule = VIEW_FIRST_SORT_COLUMN_RULES[type || VIEW_TYPE.TABLE];
    this.checkColumnEnableSortRule = VIEW_SORT_COLUMN_RULES[type || VIEW_TYPE.TABLE];
    this.columns = columns.filter(column => this.checkColumnEnableSortRule(column));
    this.initSorts = getDisplaySorts(sorts, columns);
    this.state = {
      sorts: [...this.initSorts],
    };
    this.isSelectOpen = false;
  }

  componentDidMount() {
    document.addEventListener('click', this.hidePopover, true);
    document.addEventListener('keydown', this.onHotKey);
    this.unsubscribeOpenSelect = context.eventBus.subscribe(EVENT_BUS_TYPE.OPEN_SELECT, this.setSelectStatus);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.hidePopover, true);
    document.removeEventListener('keydown', this.onHotKey);
    this.unsubscribeOpenSelect();
  }

  hidePopover = (e) => {
    if (document.getElementsByClassName('seaqa-select-options-container').length > 0) return;
    if (this.sortPopoverRef && !getEventClassName(e).includes('popover') && !this.sortPopoverRef.contains(e.target)) {
      this.onClosePopover();
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
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

  UNSAFE_componentWillReceiveProps(nextProps) {
    const newColumns = nextProps.columns || [];
    if (newColumns !== this.props.columns) {
      this.columns = newColumns.filter(column => this.checkColumnEnableSortRule(column));
    }
  }

  addSort = () => {
    const { sorts } = this.state;
    const newSorts = execSortsOperation(SORT_OPERATION.ADD_SORT, { sorts });
    this.updateSorts(newSorts, true);
  };

  deleteSort = (event, index) => {
    event.nativeEvent.stopImmediatePropagation();
    const sorts = this.state.sorts.slice(0);
    const newSorts = execSortsOperation(SORT_OPERATION.DELETE_SORT, { sorts, index });
    this.updateSorts(newSorts);
  };

  onSelectColumn = (newColumnKey, index) => {
    const sorts = this.state.sorts.slice(0);
    if (newColumnKey === sorts[index].column_key) return;
    const newSorts = execSortsOperation(SORT_OPERATION.MODIFY_SORT_COLUMN, { sorts, index, column_key: newColumnKey });
    this.updateSorts(newSorts);
  };

  onSelectSortType = (newSortType, index) => {
    const sorts = this.state.sorts.slice(0);
    if (newSortType === sorts[index].sort_type) {
      return;
    }
    const newSorts = execSortsOperation(SORT_OPERATION.MODIFY_SORT_TYPE, { sorts, index, sort_type: newSortType });
    this.updateSorts(newSorts);
  };

  updateSorts = (sorts, isAddSort = false) => {
    this.setState({ sorts }, () => {
      if (!isAddSort) return;
      if (!this.sortsListRef) return;
      this.sortsListRef.scrollTo({ top: this.sortsListRef.scrollHeight, behavior: 'smooth' });
    });
  };

  onClosePopover = () => {
    const { readOnly, columns } = this.props;
    const { sorts } = this.state;
    const isChanged = !ObjectUtils.isSameObject(this.initSorts, getDisplaySorts(sorts, columns));
    if (!readOnly && isChanged) {
      this.props.update({ sorts });
    }
    this.props.hidePopover();
  };

  renderSortsList = () => {
    const { columns } = this.props;
    const { sorts } = this.state;
    return sorts.map((sort, index) => {
      const column = getColumnByKey(columns, sort.column_key) || {};
      return this.renderSortItem(column, sort, index);
    });
  };

  renderSortItem = (column, sort, index) => {
    const { readOnly = false } = this.props;

    let columns = this.columns;
    if (index === 0) {
      columns = columns.filter(column => this.checkColumnEnableFirstSortRule(column));
    }

    return (
      <div key={'sort-item-' + index} className="sort-item">
        {!readOnly &&
          <div className="delete-sort" onClick={(event) => this.deleteSort(event, index)}>
            <Icon className="sea-metadata-icon" symbol="close"/>
          </div>
        }
        <div className="condition">
          <div className="sort-column">
            <ColumnSelector
              value={column.key}
              columns={columns}
              disabled={readOnly}
              onChange={(value) => this.onSelectColumn(value, index)}
            />
          </div>
          <div className="sort-predicate ml-2">
            <SortSelector
              disabled={readOnly}
              value={sort.sort_type}
              onChange={(value) => this.onSelectSortType(value, index)}
            />
          </div>
        </div>
      </div>
    );
  };

  onPopoverInsideClick = (e) => {
    e.stopPropagation();
  };

  render() {
    const { target, readOnly = false } = this.props;
    const { sorts } = this.state;
    const isEmpty = isSortsEmpty(sorts);
    return (
      <UncontrolledPopover
        placement="bottom-end"
        isOpen={true}
        target={target}
        fade={false}
        hideArrow={true}
        className={classnames('sea-metadata-sort-popover', { 'disabled': readOnly })}
        boundariesElement={document.body}
      >
        <div ref={ref => this.sortPopoverRef = ref} onClick={this.onPopoverInsideClick}>
          <div
            className={classnames('sorts-list', { 'empty-sorts-container d-flex align-items-center justify-content-center': isEmpty })}
            ref={ref => this.sortsListRef = ref}
          >
            {isEmpty ?
              <div className="seaqa-tip-default font-size-14 line-height-22">{gettext('No sorts')}</div> :
              this.renderSortsList()
            }
          </div>
          {!readOnly &&
            <div className="popover-add-tool">
              <CustomizeAddTool
                callBack={this.addSort}
                name={gettext('Add sort')}
              />
            </div>
          }
        </div>
      </UncontrolledPopover>
    );
  }
}

SortPopover.propTypes = propTypes;

export default SortPopover;
