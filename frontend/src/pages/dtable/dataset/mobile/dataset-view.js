import React from 'react';
import PropTypes from 'prop-types';
import Loading from '../../../../components/loading';
import { Utils } from '../../../../utils/utils';
import { dtableWebAPI } from '../../../../api/dtable-web-api';
import DatasetRecordList from '../../dialog/dataset-widgets/dataset-record-list';

import '../../css/dataset-view.css';
import '../../css/dataset-common.css';

const propTypes = {
  dataset: PropTypes.object.isRequired,
  toggle: PropTypes.func.isRequired,
};

class DatasetView extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      errorMsg: null,
      isLoading: true,
      hasMore: true,
      isLoadingMore: false,
      columns: [],
      rows: [],
      relatedUserList: [],
    };
    this.page = 1;
    this.limit = 25;
    this.isFirstLoading = true;
  }

  componentDidMount() {
    // calculate the minimum number of rows that a page can hold.
    // 60: dialog margin; 32: row's height
    const minRows = (window.innerHeight - 60) / 32;
    // take an integer multiple of 10
    const minLimit = Math.ceil(minRows / 10) * 10;
    this.limit = Math.max(this.limit, minLimit);
    this.loadCommonDateset();
  }

  loadCommonDateset = () => {
    const { dataset } = this.props;
    if (!dataset || !dataset.id) return;
    const { page, limit } = this;
    const start = (page - 1) * limit;
    dtableWebAPI.getCommonDataset(dataset.id, start, limit).then(res => {
      const { columns, rows, related_user_list } = res.data;
      if (this.isFirstLoading) {
        this.isFirstLoading = false;
        this.setState({
          isLoading: false,
          hasMore: rows.length === limit,
          rows: rows,
          columns: columns,
          relatedUserList: related_user_list,
        });
      } else {
        const { rows: oldRows } = this.state;
        const newRows = oldRows.concat(rows);
        this.setState({
          isLoadingMore: false,
          hasMore: rows.length === limit,
          rows: newRows,
        });
      }
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      this.setState({
        isLoading: false,
        isLoadingMore: false,
        errorMsg: errMessage
      });
    });
  };

  toggle = () => {
    this.props.toggle();
  };

  onScroll = () => {
    if (!this.state.hasMore) return;
    if (this.state.isLoadingMore) return;
    if (this.container.offsetHeight + this.container.scrollTop >= this.content.offsetHeight) {
      this.setState({ isLoadingMore: true }, () => {
        this.page = this.page + 1;
        this.loadCommonDateset();
      });
    }
  };

  setContentRef = (ref) => {
    this.content = ref;
  };

  setContainerRef = (ref) => {
    this.container = ref;
  };

  render() {
    const { dataset } = this.props;
    const { isLoading, isLoadingMore, errorMsg, columns, rows, relatedUserList } = this.state;
    return (
      <div className="dataset-view">
        <div className="dataset-view-header">
          <span className="dataset-view-header-btn" onClick={this.toggle}>
            <i className="dataset-view-icon dtable-font dtable-icon-return"></i>
          </span>
          <h4 className="dataset-view-header-title">{dataset.dataset_name}</h4>
          <span className="dataset-view-header-btn"></span>
        </div>
        <div className="dataset-view-content" ref={this.setContainerRef} onScroll={this.onScroll}>
          {isLoading && <Loading />}
          {!isLoading && errorMsg && <p className="error text-center">{errorMsg}</p>}
          {!isLoading && !errorMsg &&
            <div className="dataset-content" ref={this.setContentRef}>
              <DatasetRecordList rows={rows} columns={columns} relatedUserList={relatedUserList} />
              {isLoadingMore && <Loading />}
            </div>
          }
        </div>
      </div>
    );
  }
}

DatasetView.propTypes = propTypes;


export default DatasetView;
