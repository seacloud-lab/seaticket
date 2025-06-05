import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { dtableWebAPI } from '../../api/dtable-web-api';
import { gettext } from '../../utils/constants';
import { Utils } from '../../utils/utils';
import DTableTrashList from './dtable-trash/dtable-trash-list';
import '../../css/dtable-trash.css';

const propTypes = {
  onCloseSidePanel: PropTypes.func,
  isTrashEmptyConfirmDialogOpen: PropTypes.bool,
  toggleTrashEmptyConfirmDialog: PropTypes.func,
};

class DTableTrash extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: false,
      trashDTableList: [],
      perPage: 25,
      currentPage: 1,
      count: 0,
      isTrashEmptyConfirmDialogOpen: false
    };
    this.flag = true;
  }

  componentDidMount() {
    this.listTrashDTablesByPage(this.state.currentPage);
  }

  listTrashDTablesByPage = (page) => {
    this.setState({ isLoading: true });
    dtableWebAPI.listTrashDTables(page, this.state.perPage).then((res) => {
      let { trashDTableList } = this.state;
      let newTrashTableList = trashDTableList.slice(0);
      const { trash_dtable_list, count } = res.data;
      newTrashTableList = newTrashTableList.concat(trash_dtable_list);
      this.setState({
        count,
        isLoading: false,
        trashDTableList: newTrashTableList,
        currentPage: page
      });
      this.flag = true;
    }).catch((error) => {
      this.setState({ isLoading: false });
      this.flag = true;
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  handleEmptyTrashTables = () => {
    dtableWebAPI.cleanTrashDTables().then((res) => {
      this.setState({
        trashDTableList: [],
        currentPage: 1
      });
      const msg = gettext('Trash cleaned');
      toaster.success(msg);
      this.toggleTrashEmptyConfirmDialog();
    }).catch((error) => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  toggleTrashEmptyConfirmDialog = () => {
    this.setState({ isTrashEmptyConfirmDialogOpen: !this.state.isTrashEmptyConfirmDialogOpen });
  };

  restoreDTable = (dtable) => {
    let trashDTableList = this.state.trashDTableList.filter(table => {
      return table.uuid !== dtable.uuid;
    });
    this.setState({ trashDTableList: trashDTableList });
  };

  handleScroll = () => {
    const { count, trashDTableList, currentPage } = this.state;
    if (trashDTableList.length < count) {
      const scrollTop = event.target.scrollTop;
      const clientHeight = event.target.clientHeight;
      const scrollHeight = event.target.scrollHeight;
      const isBottom = (clientHeight + scrollTop + 1 >= scrollHeight);
      if (isBottom && this.flag) {
        this.flag = false;
        this.listTrashDTablesByPage(currentPage + 1);
      }
    }
  };

  render() {
    return (
      <Fragment>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <div className="cur-view-content pb-8" onScroll={this.handleScroll}>
              <div className="trash-tables-title">
                <span>{gettext('Trash')}</span>
                <Button onClick={this.toggleTrashEmptyConfirmDialog}>
                  {gettext('Clean')}
                </Button>
              </div>
              <DTableTrashList
                isLoading={this.state.isLoading}
                trashDTableList={this.state.trashDTableList}
                restoreDTable={this.restoreDTable}
                isTrashEmptyConfirmDialogOpen={this.state.isTrashEmptyConfirmDialogOpen}
                toggleTrashEmptyConfirmDialog={this.toggleTrashEmptyConfirmDialog}
                handleEmptyTrashTables={this.handleEmptyTrashTables}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

DTableTrash.propTypes = propTypes;

export default DTableTrash;
