import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { CellType } from 'dtable-utils';
import RecordsHeader from './records-header';
import RecordsBody from './records-body';
import RecordsFooter from './records-footer';
import { DATASET_NOT_SUPPORT_COLUMN_TYPES, getCellRecordWidth } from './dataset-utils';

const MODAL_MARGIN = 30;
const MODAL_PADDING = 16;

class Records extends Component {

  constructor(props) {
    super(props);
    this.state = {
      scrollLeft: 0,
    };
    this.resultContainerRef = null;
    this.displayColumns = props.columns
      .filter(column => !DATASET_NOT_SUPPORT_COLUMN_TYPES.includes(column.type))
      .map(column => {
        const { type } = column;
        if (type === CellType.LINK) {
          const { data } = column;
          const { display_column_key, array_type, array_data } = data;
          const display_column = {
            key: display_column_key || '0000',
            type: array_type || CellType.TEXT,
            data: array_data || null
          };
          return {
            ...column,
            width: getCellRecordWidth(column),
            data: { ...data, display_column }
          };
        }
        return {
          ...column,
          width: getCellRecordWidth(column),
        };
      });
  }

  getVerticalScrollbarRight = () => {
    if (this.resultContainerRef) {
      return MODAL_PADDING + MODAL_MARGIN;
    }
  };

  render() {
    const { records, collaborators } = this.props;
    const recordsCount = records.length;
    const totalWidth = this.displayColumns.reduce((cur, nextColumn) => (cur + nextColumn.width), 0);
    const columnContainerWidth = window.innerWidth - MODAL_MARGIN * 2 - MODAL_PADDING * 2;
    const isYScrollbar = columnContainerWidth < totalWidth;
    return (
      <>
        <div className="dataset-result-container" ref={ref => this.resultContainerRef = ref}>
          <div className="dtable-dataset-result-content" style={{ width: totalWidth }}>
            <RecordsHeader columns={this.displayColumns} />
            <RecordsBody
              records={records}
              columns={this.displayColumns}
              collaborators={collaborators}
              getUserCommonInfo={this.props.getUserCommonInfo}
              getOptionColors={this.props.getOptionColors}
              openEnlargeFormatter={this.props.openEnlargeFormatter}
              onOpenRecordExpandDialog={this.props.onOpenRecordExpandDialog}
              loadMoreCommonDataset={this.props.loadMoreCommonDataset}
              isLoadingMore={this.props.isLoadingMore}
              queryUsers={this.props.queryUsers}
              getVerticalScrollbarRight={this.getVerticalScrollbarRight}
              isYScrollbar={isYScrollbar}
            />
          </div>
        </div>
        <RecordsFooter recordsCount={recordsCount} hasMore={this.props.hasMore}/>
      </>
    );
  }
}

Records.propTypes = {
  isLoadingMore: PropTypes.bool,
  hasMore: PropTypes.bool,
  records: PropTypes.array,
  columns: PropTypes.array,
  collaborators: PropTypes.array,
  getOptionColors: PropTypes.func,
  getUserCommonInfo: PropTypes.func,
  openEnlargeFormatter: PropTypes.func,
  onOpenRecordExpandDialog: PropTypes.func,
  loadMoreCommonDataset: PropTypes.func,
  queryUsers: PropTypes.func,
};

export default Records;
