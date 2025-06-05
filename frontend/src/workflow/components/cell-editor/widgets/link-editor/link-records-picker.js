import React from 'react';
import PropTypes from 'prop-types';
import MediaQuery from 'react-responsive';
import { Loading, toaster, DTableSearchInput, ClickOutside } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../../../api/dtable-web-api';
import { Utils, isShiftKeyDown } from '../../../../../utils/utils';
import { LinkRecordsListHeader, RowCardItem } from '../../../common/row-cards';
import MobileCommonHeader from '../../../../../pages/dtable/mobile/mobile-common-header';
import { searchRowsBySearchValue } from '../../../../utils/search-utils';
import { getLinkFieldsSettings } from '../../../../../workflow/utils/utils';

import './index.css';

const propTypes = {
  token: PropTypes.string,
  workflowTaskId: PropTypes.number,
  popoverStyle: PropTypes.object,
  nameColumn: PropTypes.object,
  column: PropTypes.object,
  columns: PropTypes.array,
  departments: PropTypes.array,
  collaborators: PropTypes.array,
  linkedRecords: PropTypes.array,
  onClickOutside: PropTypes.func,
  addLinkedRows: PropTypes.func,
  insertNewLinkedRow: PropTypes.func,
  editorConfig: PropTypes.object,
};

const gettext = window.gettext;

// 98: row-card-item height + margin top = 88 + 10 = 98
const CARD_RECORD_ITEM_HEIGHT = 98;

class LinkRecordsPicker extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      searchValue: '',
      scrollLeft: 0,
      highlightIndex: 0,
      maxItemNum: 0,
      filteredRecords: [],
      displayRecords: [],
      isLoading: true,
    };
    this.recordsList = null;
    this.recordItem = [];
    this.linkedTableFilterRecords = [];
    this.searchedFilterRecords = [];
    this.currentDisplayRowMinIndex = 0;
    this.currentDisplayRowMaxIndex = 0;
  }

  componentDidMount() {
    const { linkedRecords, token, column, workflowTaskId } = this.props;
    const taskId = workflowTaskId ? workflowTaskId : '';
    dtableWebAPI.getLinkedTableRowsWithWorkflow(token, column.key, taskId).then(res => {
      this.linkedTableFilterRecords = res.data.linked_table_rows;
      const filteredRecords = this.getFilteredRecords(this.linkedTableFilterRecords, linkedRecords, true);
      this.setState({
        isLoading: false,
        filteredRecords,
        displayRecords: filteredRecords.slice(0, 10)
      });
    }).catch(error => {
      this.setState({ isLoading: false });
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });

    this.currentDisplayRowMaxIndex = Math.floor((0 + this.recordsList.offsetHeight) / CARD_RECORD_ITEM_HEIGHT);
    if (this.recordsList) {
      const selectContainerStyle = getComputedStyle(this.recordsList, null);
      const maxSelectItemNum = Math.floor(parseInt(selectContainerStyle.height) / CARD_RECORD_ITEM_HEIGHT);
      this.setState({ maxItemNum: maxSelectItemNum - 1 });
    }
    document.addEventListener('keydown', this.onKeyDown);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.props.linkedRecords !== nextProps.linkedRecords) {
      this.recordItem = [];
      this.currentDisplayRowMinIndex = 0;
      this.currentDisplayRowMaxIndex = Math.floor((0 + this.recordsList.offsetHeight) / CARD_RECORD_ITEM_HEIGHT);
      const filteredRecords = this.getFilteredRecords(this.linkedTableFilterRecords, nextProps.linkedRecords, false);
      this.setState({
        filteredRecords,
        displayRecords: filteredRecords.slice(0, 10)
      });
    }
  }

  componentWillUnmount() {
    this.recordsList = null;
    this.recordsContainer = null;
    this.recordItem = [];
    this.searchedFilterRecords = [];
    this.currentDisplayRowMinIndex = 0;
    this.currentDisplayRowMaxIndex = 0;
    document.removeEventListener('keydown', this.onKeyDown);
  }

  onKeyDown = (e) => {
    if (e.keyCode === Utils.keyCodes.enter) {
      this.onEnter(e);
    } else if (e.keyCode === Utils.keyCodes.up) {
      this.onUpArrow(e);
    } else if (e.keyCode === Utils.keyCodes.down) {
      this.onDownArrow(e);
    } else if (e.keyCode === Utils.keyCodes.esc) {
      this.props.onClickOutside();
    }
  };

  onEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { highlightIndex, displayRecords } = this.state;
    const record = displayRecords[highlightIndex];
    if (record) {
      this.props.insertNewLinkedRow(record);
    }
  };

  onUpArrow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { highlightIndex, displayRecords, maxItemNum } = this.state;
    const newHighLightIndex = highlightIndex - 1;
    if (newHighLightIndex > -1) {
      this.setState({ highlightIndex: newHighLightIndex }, () => {
        if (highlightIndex < displayRecords.length - maxItemNum) {
          this.recordsList.scrollTop -= CARD_RECORD_ITEM_HEIGHT;
        }
      });
    }
  };

  onDownArrow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { highlightIndex, displayRecords, maxItemNum } = this.state;
    const newHighLightIndex = highlightIndex + 1;
    if (highlightIndex < displayRecords.length - 1) {
      this.setState({ highlightIndex: newHighLightIndex }, () => {
        if (highlightIndex >= maxItemNum) {
          this.recordsList.scrollTop += CARD_RECORD_ITEM_HEIGHT;
        }
      });
    }
  };

  getFilteredRecords = (linkedTableFilterRecords, linkedRecords, isFirstLoad) => {
    // First Loading, don't show all linked rows
    if (isFirstLoad) {
      let init_ids_map = {};
      linkedRecords.forEach(record => init_ids_map[record._id] = true);
      this.init_ids_map = init_ids_map;
      return linkedTableFilterRecords.filter(record => !init_ids_map[record._id]);
    } else {
      let ids_map = {};
      linkedRecords.forEach(record => ids_map[record._id] = true);
      return linkedTableFilterRecords
        // If row was not show at first time, then it is still not show
        .filter(record => !this.init_ids_map[record._id])
        // If row is selected, add a green tick
        .map(record => ids_map[record._id] ? Object.assign({}, record, { isShowTick: true }) : record);
    }
  };

  getSearchedRecords = (searchValue = '') => {
    if (searchValue === '') {
      this.clearSearch();
      return;
    }
    const value = searchValue ? searchValue.trim() : '';
    if (!value) return;

    const { columns } = this.props;
    const rows = this.state.filteredRecords.slice(0);
    const searchedFilterRecords = searchRowsBySearchValue({ rows, columns, searchValue, isArchiveView: true });

    this.searchedFilterRecords = searchedFilterRecords;
    this.setState({ displayRecords: searchedFilterRecords });
  };

  clearSearch = () => {
    const { filteredRecords } = this.state;
    this.searchedFilterRecords = [];
    this.setState({
      searchValue: '',
      displayRecords: filteredRecords.slice(0, 10)
    });
  };

  onRef = (ref, rowIdx) => {
    this.recordItem[rowIdx] = ref;
  };

  onChange = (searchValue) => {
    this.setState({ searchValue });
    this.getSearchedRecords(searchValue);
  };

  onClickRecord = (record, e) => {
    const { column } = this.props;
    const { displayRecords, highlightIndex } = this.state;
    const selectedRowIdx = displayRecords.findIndex(row => row._id === record._id);
    this.setState({ highlightIndex: selectedRowIdx }, () => {
      const { link_at_most_one_record: linkAtMostOneRecord } = column;
      if (!linkAtMostOneRecord && isShiftKeyDown(e) && displayRecords && displayRecords.length > 0) {
        const [startIdx, endIdx] = highlightIndex > selectedRowIdx ? [selectedRowIdx, highlightIndex] : [highlightIndex, selectedRowIdx];
        const selectedRecords = displayRecords.slice(startIdx, endIdx + 1);
        this.props.addLinkedRows(selectedRecords);
      } else {
        this.props.insertNewLinkedRow(record);
      }
    });
  };

  setScrollLeft = (scrollLeft) => {
    this.setState({ scrollLeft });
  };

  setItemScrollLeft = (scrollLeft, currentRecordIdx) => {
    this.rowCardHeaderRef.setHeaderScrollLeft(scrollLeft);
    const start = this.currentDisplayRowMinIndex;
    const end = this.currentDisplayRowMaxIndex;
    for (let i = start; i <= end; i++) {
      if (i !== currentRecordIdx && this.recordItem[i]) {
        let cardRecordScrollLeft = this.recordItem[i].getScrollLeft();
        if (cardRecordScrollLeft !== scrollLeft) {
          this.recordItem[i].setScrollLeft(scrollLeft);
        }
      }
    }
  };

  scrollToMore = (e) => {
    e.stopPropagation();
    let { displayRecords: currentDisplayRecords, scrollLeft, filteredRecords } = this.state;
    let currentDisplayRecordsCount = currentDisplayRecords.length;
    let { offsetHeight, scrollTop } = this.recordsList;
    this.currentDisplayRowMinIndex = Math.floor(scrollTop / CARD_RECORD_ITEM_HEIGHT);
    this.currentDisplayRowMaxIndex = Math.floor((scrollTop + offsetHeight) / CARD_RECORD_ITEM_HEIGHT);
    if (scrollLeft >= 0) {
      this.setItemScrollLeft(scrollLeft, -1);
    }
    if (currentDisplayRecordsCount >= filteredRecords.length) return;
    if (offsetHeight + scrollTop + 10 >= this.recordsContent.offsetHeight) {
      let displayRecords = filteredRecords.slice(currentDisplayRecordsCount, currentDisplayRecordsCount + 10);
      this.setState({ displayRecords: currentDisplayRecords.concat(...displayRecords) });
    }
  };

  getCurrentDisplayRowMaxIndex = () => {
    if (this.recordsList) {
      this.currentDisplayRowMaxIndex = Math.floor((0 + this.recordsList.offsetHeight) / CARD_RECORD_ITEM_HEIGHT);
    }
  };

  setRecordsListRef = (ref) => {
    this.recordsList = ref;
  };

  renderHeader = () => {
    return (
      <>
        <MediaQuery query="(max-width: 767.8px)">
          <MobileCommonHeader
            title={gettext('Link existing records')}
            onLeftClick={this.props.onClickOutside}
            onRightClick={this.props.onClickOutside}
            leftName={gettext('Cancel')}
            rightName={gettext('Done')}
          />
          {this.renderSearchInputContainer()}
        </MediaQuery>
        <MediaQuery query="(min-width: 767.8px)">
          <div className="link-records-search">
            <div className="link-records-search-header">
              <div className="link-records-title">
                <span>{gettext('Link existing records')}</span>
              </div>
              <button type="button" className="close" aria-label="Close" onClick={this.props.onClickOutside}>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            {this.renderSearchInputContainer()}
          </div>
        </MediaQuery>
      </>
    );
  };

  renderSearchInputContainer = () => {
    return (
      <div className="search-input-container">
        <i className="search-icon dtable-font dtable-icon-search"></i>
        <DTableSearchInput
          placeholder={gettext('Search records')}
          className="search-tables-input"
          onChange={this.onChange}
          autoFocus={true}
          isClearable={true}
          clearValue={this.clearSearch}
          value={this.state.searchValue}
          components={{
            ClearIndicator: (props) => {
              return (
                <span className="clear-search-text" onMouseDown={this.clearSearch}>
                  <i className="dtable-font dtable-icon-x-"></i>
                </span>
              );
            }
          }}
        />
      </div>
    );
  };

  renderContent = () => {
    const { displayRecords, scrollLeft, isLoading, highlightIndex } = this.state;
    const { columns, nameColumn, collaborators, column, departments } = this.props;
    const { linkVisibleFields } = getLinkFieldsSettings(column);
    const displayColumns = columns.filter(column => column.key !== nameColumn.key && linkVisibleFields.includes(column.key));

    return (
      <div className="link-records-container">
        <div className="workflow-row-card-header">
          <LinkRecordsListHeader
            scrollLeft={scrollLeft}
            columns={displayColumns}
            setItemScrollLeft={this.setItemScrollLeft}
            setScrollLeft={this.setScrollLeft}
            getCurrentDisplayRowMaxIndex={this.getCurrentDisplayRowMaxIndex}
            ref={ref => this.rowCardHeaderRef = ref}
          />
        </div>
        <div className="row-cord-list" ref={this.setRecordsListRef} onScroll={this.scrollToMore}>
          {isLoading && <Loading/>}
          {!isLoading && displayRecords.length === 0 &&
            <div className="no-records-tips">{gettext('No optional records')}</div>
          }
          {displayRecords.length > 0 &&
            <div className="row-cord-content" ref={ref => this.recordsContent = ref}>
              {displayRecords.map((row, rowIdx) => {
                return (
                  <RowCardItem
                    key={`linked-row-card-${rowIdx}`}
                    isShowRemoveCardItemBtn={false}
                    isHighLight={highlightIndex === rowIdx}
                    row={row}
                    rowIdx={rowIdx}
                    nameColumn={nameColumn}
                    collaborators={collaborators}
                    columns={displayColumns}
                    onSelectRow={this.onClickRecord}
                    onRef={this.onRef}
                    setItemScrollLeft={this.setItemScrollLeft}
                    editorConfig={this.props.editorConfig}
                    departments={departments}
                  />
                );
              })}
            </div>
          }
        </div>
      </div>
    );
  };

  render() {
    const { popoverStyle } = this.props;
    return (
      <ClickOutside onClickOutside={this.props.onClickOutside}>
        <div className="link-records-picker" style={popoverStyle}>
          {this.renderHeader()}
          {this.renderContent()}
        </div>
      </ClickOutside>
    );
  }
}

LinkRecordsPicker.propTypes = propTypes;

export default LinkRecordsPicker;
