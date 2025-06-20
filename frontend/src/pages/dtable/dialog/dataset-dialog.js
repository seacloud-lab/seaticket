import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import Loading from '../../../components/loading';
import { DTableModalHeader } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';
import { seaQAAPI } from '../../../api/web-api';
import Records from './dataset-widgets/records';
import UserService from '../../../utils/user-service';

import '../css/dataset-common.css';
import '../css/dataset-dialog.css';

const propTypes = {
  dataset: PropTypes.object.isRequired,
  toggle: PropTypes.func.isRequired,
};

class DatasetDialog extends React.Component {

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
      displayRows: []
    };
    this.page = 1;
    this.limit = 25;
    this.isFirstLoading = true;
    this.rowsMap = {};
    this.userService = new UserService();
    this.relatedUserEmailMap = {};
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
    seaQAAPI.getCommonDataset(dataset.id, start, limit).then(res => {
      const { columns, rows, related_user_list } = res.data;
      rows.forEach(row => {
        this.rowsMap[row._id] = row;
      });
      related_user_list.forEach(user => {
        this.relatedUserEmailMap[user.email] = true;
      });
      if (this.isFirstLoading) {
        this.isFirstLoading = false;
        this.setState({
          isLoading: false,
          hasMore: rows.length === limit,
          rows: rows,
          columns: columns,
          relatedUserList: related_user_list,
          displayRows: rows,
        });
      } else {
        const { rows: oldRows } = this.state;
        const newRows = oldRows.concat(rows);
        this.setState({
          isLoadingMore: false,
          hasMore: rows.length === limit,
          rows: newRows,
          displayRows: newRows,
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

  queryUsers = (emails) => {
    let queryEmails = emails.filter(email => {
      return !this.relatedUserEmailMap[email];
    });
    this.userService.queryUsers(queryEmails, this.updateRelatedUser);
  };

  updateRelatedUser = (emailUserMap) => {
    let newUsers = [...this.state.relatedUserList];
    for (let email in emailUserMap) {
      if (!this.relatedUserEmailMap[email]) {
        this.relatedUserEmailMap[email] = true;
        newUsers.push(emailUserMap[email]);
      }
    }
    if (this.state.relatedUserList.length !== newUsers.length) {
      this.setState({
        relatedUserList: newUsers,
      });
    }
  };

  toggle = () => {
    this.props.toggle();
  };

  loadMoreCommonDataset = () => {
    if (!this.state.hasMore) return;
    if (this.state.isLoadingMore) return;
    this.setState({ isLoadingMore: true }, () => {
      this.page = this.page + 1;
      this.loadCommonDateset();
    });
  };

  render() {
    const { dataset } = this.props;
    const { isLoading, isLoadingMore, errorMsg, columns, displayRows, relatedUserList, hasMore } = this.state;

    return (
      <Modal className="dataset-dialog" isOpen={true} toggle={this.toggle} size="lg">
        <DTableModalHeader toggle={this.toggle}>{dataset.dataset_name}</DTableModalHeader>
        <ModalBody>
          <>
            {isLoading && <Loading />}
            {!isLoading && errorMsg && <p className="error text-center">{errorMsg}</p>}
            {!isLoading && !errorMsg &&
              <div className="dtable-dataset-result success">
                <Records
                  hasMore={hasMore}
                  columns={columns}
                  records={displayRows}
                  collaborators={relatedUserList}
                  loadMoreCommonDataset={this.loadMoreCommonDataset}
                  isLoadingMore={isLoadingMore}
                  queryUsers={this.queryUsers}
                />
              </div>
            }
          </>
        </ModalBody>
      </Modal>
    );
  }
}

DatasetDialog.propTypes = propTypes;

export default DatasetDialog;
