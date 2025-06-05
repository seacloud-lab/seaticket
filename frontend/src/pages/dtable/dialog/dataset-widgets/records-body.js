import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Record from './record';
import Loading from '../../../../components/loading';
import VerticalScrollbar from './vertical-scrollbar';

class RecordsBody extends Component {

  constructor(props) {
    super(props);
    this.datasetResultRef = null;
    this.datasetResultContentRef = null;
    this.verticalScrollbar = null;
  }

  onScroll = () => {
    if (this.datasetResultContentRef.offsetHeight + this.datasetResultContentRef.scrollTop >= this.datasetResultRef.offsetHeight) {
      this.props.loadMoreCommonDataset();
    }
    if (this.verticalScrollbar) {
      this.verticalScrollbar.setScrollTop(this.datasetResultContentRef.scrollTop);
    }
  };

  onVerticalScrollbarScroll = (scrollTop) => {
    this.datasetResultContentRef.scrollTop = scrollTop;
  };

  render() {
    const { records, collaborators, columns, isLoadingMore, isYScrollbar } = this.props;
    return (
      <div
        className={classnames('dtable-dataset-result-table-content', { 'content-no-y-scrollbar': isYScrollbar })}
        onScroll={this.onScroll}
        ref={ref => this.datasetResultContentRef = ref}
      >
        <div className="dtable-dataset-result-table" ref={ref => this.datasetResultRef = ref}>
          {records.map((record, index) => {
            return (
              <Record
                key={record._id || index}
                columns={columns}
                record={record}
                index={index}
                collaborators={collaborators}
                openEnlargeFormatter={this.props.openEnlargeFormatter}
                getUserCommonInfo={this.props.getUserCommonInfo}
                getOptionColors={this.props.getOptionColors}
                onOpenRecordExpandDialog={this.props.onOpenRecordExpandDialog}
                isLastRecord={records.length - 1 === index}
                queryUsers={this.props.queryUsers}
              />
            );
          })}
        </div>
        {isLoadingMore &&
          <div className="dtable-dataset-result-loading">
            <Loading />
          </div>
        }
        {(isYScrollbar && this.datasetResultContentRef) && (
          <VerticalScrollbar
            containerHeight={this.datasetResultContentRef.offsetHeight}
            contentHeight={33 * records.length}
            ref={ref => this.verticalScrollbar = ref}
            onScrollbarScroll={this.onVerticalScrollbarScroll}
            getVerticalScrollbarRight={this.props.getVerticalScrollbarRight}
          />
        )}
      </div>
    );
  }
}

RecordsBody.propTypes = {
  isLoadingMore: PropTypes.bool,
  records: PropTypes.array.isRequired,
  columns: PropTypes.array.isRequired,
  scrollLeft: PropTypes.number,
  collaborators: PropTypes.array.isRequired,
  recordHeight: PropTypes.string,
  getUserCommonInfo: PropTypes.func,
  getOptionColors: PropTypes.func,
  openEnlargeFormatter: PropTypes.func,
  onOpenRecordExpandDialog: PropTypes.func,
  loadMoreCommonDataset: PropTypes.func,
  queryUsers: PropTypes.func,
  getVerticalScrollbarRight: PropTypes.func,
};

export default RecordsBody;
