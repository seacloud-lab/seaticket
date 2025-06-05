import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Modal, ModalBody } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';
import { gettext } from '../../../utils/constants';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import Loading from '../../../components/loading';
import LoadMore from '../../../components/load-more';
import SnapshotRestoreDialog from './snapshot-restore-dialog';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  workspace: PropTypes.object.isRequired,
  dtable: PropTypes.object.isRequired,
  toggleCancel: PropTypes.func.isRequired,
  onAddDTable: PropTypes.func.isRequired,
};

class TableSnapshotsDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isSnapshotsLoading: true,
      snapshots: [],
      errorMsg: null,
      page: 1,
      perPage: 20,
      hasNextPage: false,
      isLoadingMore: false,
      currentSnapshot: null,
      isSnapshotRestoreShow: false,
    };
  }

  componentDidMount() {
    let { page, perPage } = this.state;
    this.loadSnapshots(page, perPage);
  }

  loadSnapshots = (page, perPage) => {
    let { workspace, dtable } = this.props;
    dtableWebAPI.listDTableSnapshots(workspace.id, dtable.name, page, perPage).then((res) => {
      let snapshots = this.state.snapshots.slice(0);
      snapshots = snapshots.concat(res.data.snapshot_list);
      this.setState({
        snapshots: snapshots,
        page: res.data.page_info.current_page,
        hasNextPage: res.data.page_info.has_next_page,
        isSnapshotsLoading: false,
        isLoadingMore: false,
        errorMsg: null
      });
    }).catch(error => {
      this.setState({
        isLoadingMore: false,
        isSnapshotsLoading: false,
      });
      let errorMsg = Utils.getErrorMsg(error, true);
      this.setState({ errorMsg: errorMsg });
    });
  };

  onLoadMoreSnapshots = () => {
    if (this.state.hasNextPage) {
      let nextPage = this.state.page + 1;
      this.setState({ isLoadingMore: true }, () => {
        this.loadSnapshots(nextPage, this.state.perPage);
      });
    }
  };

  toggle = () => {
    this.props.toggleCancel();
  };

  toggleSnapshotRestore = (snapshot) => {
    this.setState({
      isSnapshotRestoreShow: !this.state.isSnapshotRestoreShow,
      currentSnapshot: snapshot
    });
  };

  restoreSnapshot = (snapshotName, password, backupVersion) => {
    let { workspace, dtable } = this.props;
    let { currentSnapshot } = this.state;
    dtableWebAPI.restoreDTableSnapshot(workspace.id, dtable.name, currentSnapshot.commit_id, snapshotName, password.trim(), backupVersion).then(res => {
      this.props.onAddDTable(res.data.dtable);
      toaster.success(gettext('Snapshot restored'));
      this.toggleSnapshotRestore();
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  onRestoreEnterClassName = () => {
    return 'restore-snapshot-in';
  };

  onRestoreOutClassName = () => {
    return 'restore-snapshot-out';
  };

  render() {
    let { server } = window.app.pageOptions;
    let { workspace, dtable } = this.props;
    let { isSnapshotsLoading, isLoadingMore, snapshots, errorMsg, isSnapshotRestoreShow } = this.state;
    return (
      <Fragment>
        <Modal isOpen={true} toggle={this.toggle}>
          <DTableModalHeader toggle={this.toggle}><span className="op-target">{dtable.name}</span>{' '}{gettext('snapshots')}</DTableModalHeader>
          <ModalBody className="dtable-snapshots-container">
            {isSnapshotsLoading && <Loading />}
            {!isSnapshotsLoading && errorMsg && <p className="d-flex justify-content-center pt-2 error">{errorMsg}</p>}
            {!isSnapshotsLoading && !errorMsg && snapshots.length === 0 && <p className="d-flex justify-content-center pt-2">{gettext('No snapshots')}</p>}
            {!isSnapshotsLoading && !errorMsg && snapshots.length > 0 && (
              <div className="dtable-snapshots-content">
                <table>
                  <thead>
                    <tr>
                      <th width="50%"><div className="ml-2">{gettext('Created time')}</div></th>
                      <th width="50%"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((snapshot, index) => {
                      let viewLink = `${server}/dtable/snapshots/workspace/${workspace.id}/dtable/${dtable.name}/${snapshot.commit_id}/`;

                      return (
                        <tr key={index}>
                          <td><div className="ml-2">{dayjs(snapshot.ctime).format('YYYY-MM-DD HH:mm')}</div></td>
                          <td>
                            <a href={viewLink} target="_blank" rel="noopener noreferrer" className="cursor-pointer">{gettext('View')}</a>
                            <span className="snapshot-split">|</span>
                            <a href="#" rel="noopener noreferrer" className="cursor-pointer" onClick={this.toggleSnapshotRestore.bind(this, snapshot)}>{gettext('Restore')}</a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {this.state.hasNextPage && <LoadMore marginTop={'8px'} isLoadingMore={isLoadingMore} onLoadMore={this.onLoadMoreSnapshots}/>}
              </div>
            )}
          </ModalBody>
        </Modal>
        {isSnapshotRestoreShow &&
        <SnapshotRestoreDialog
          toggle={this.toggleSnapshotRestore}
          restoreSnapshot={this.restoreSnapshot}
          dtable={dtable}
          workspace={workspace}
        />}
      </Fragment>
    );
  }
}

TableSnapshotsDialog.propTypes = propTypes;

export default TableSnapshotsDialog;
