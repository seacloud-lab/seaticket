import React from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { Utils } from '../../../utils/utils';
import { toaster, DTableSwitch, DTableModalHeader } from 'dtable-ui-component';
import { Modal, ModalBody, ModalFooter, Button, Label } from 'reactstrap';
import { gettext } from '../../../utils/constants';
import Loading from '../../../components/loading';
import DTableItem from '../dtable-item';

import '../../../css/force-sync-common-dataset-dialog.css';

const propTypes = {
  dataset: PropTypes.object,
  toggle: PropTypes.func
};

class ForceSyncCommonDatasetDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      importDtables: [],
      syncImportDtableIds: [],
      isLoading: true,
      isSyncing: false
    };
    this.timer = null;
    this.isStatusQueryDone = true;
  }

  componentDidMount() {
    const { dataset } = this.props;
    dtableWebAPI.getCommonDatasetInfo(dataset.id).then(res => {
      const { data: { dataset_info: datasetInfo } } = res;
      const { import_groups: importGroups } = datasetInfo;
      const importDtables = this.getImportTables(importGroups);
      this.setState({
        datasetInfo,
        importDtables,
        syncImportDtableIds: importDtables.map(item => item.dtableId),
        isLoading: false,
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
      this.setState({
        isLoading: false,
      });
    });
  }

  getImportTables = (groups) => {
    const dtables = [];
    groups.forEach(group => {
      const { import_dtables: importDtables } = group;
      importDtables.forEach(dtable => {
        const {
          dtable_name: dtableName,
          dtable_uuid: dtableId,
          import_tables: importTables,
          color,
          icon,
        } = dtable;
        dtables.push({ dtableName, dtableId, importTables, color, icon });
      });
    });
    return dtables;
  };

  forceSyncCommonDataset = () => {
    const { dataset } = this.props;
    let taskId;
    this.setState({ isSyncing: true });
    dtableWebAPI.forceSyncCommonDataset(dataset.id, this.state.syncImportDtableIds).then(res => {
      taskId = res.data.task_id;
      toaster.success(gettext('It may take some time, please wait'));
      return dtableWebAPI.queryDTableIOStatusByTaskId(taskId);
    }).then(res => {
      const isFinished = res.data.is_finished;
      if (isFinished) {
        this.setState({ isSyncing: false });
        toaster.success(gettext('All selected bases have been synced.'));
        this.toggle();
        return;
      }
      this.timer = setInterval(() => {
        if (!this.isStatusQueryDone) return;
        this.isStatusQueryDone = false;
        dtableWebAPI.queryDTableIOStatusByTaskId(taskId).then(res => {
          this.isStatusQueryDone = true;
          const isFinished = res.data.is_finished;
          if (isFinished) {
            toaster.success(gettext('All selected bases have been synced.'));
            clearInterval(this.timer);
            this.setState({ isSyncing: false });
            this.toggle();
          }
        }).catch(error => {
          let errMessage = Utils.getErrorMsg(error);
          toaster.danger(errMessage);
          clearInterval(this.timer);
          this.setState({ isSyncing: false });
        });
      }, 1000);
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  toggle = () => {
    this.props.toggle();
  };

  onSyncChange = (e, dtableId) => {
    const syncImportDtableIds = this.state.syncImportDtableIds.slice(0);
    if (e.target.checked === true && !syncImportDtableIds.includes(dtableId)) {
      syncImportDtableIds.push(dtableId);
    } else if (e.target.checked === false && syncImportDtableIds.includes(dtableId)) {
      const index = syncImportDtableIds.indexOf(dtableId);
      syncImportDtableIds.splice(index, 1);
    }
    this.setState({ syncImportDtableIds });
  };

  renderDtables = () => {
    const { importDtables } = this.state;
    if (importDtables.length === 0) {
      return (
        <div className="mx-4">{gettext('No bases')}</div>
      );
    }
    return (
      <div className='force-sync-common-dataset-container'>
        <Label>{gettext('Select the bases that you wish to sync with the common dataset now.')}</Label>
        <table className="table-hover">
          <thead>
            <tr>
              <th width="15%">{gettext('Sync')}</th>
              <th width="50%">{gettext('Base')}</th>
              <th width="35%">{gettext('Last sync')}</th>
            </tr>
          </thead>
          <tbody>
            {importDtables.map((dtable, index) => {
              const lastSyncTime = (Array.isArray(dtable.importTables) && dtable.importTables[0]) ? dtable.importTables[0].last_sync_time : '';
              return (
                <tr key={index}>
                  <td>
                    <DTableSwitch
                      switchClassName="force-sync-common-dataset-switch d-flex"
                      placeholder=''
                      checked={this.state.syncImportDtableIds.includes(dtable.dtableId)}
                      onChange={(e) => this.onSyncChange(e, dtable.dtableId)}
                    />
                  </td>
                  <td className='d-flex'>
                    <DTableItem dtableColor={dtable.color} dtableIcon={dtable.icon} />
                    <div className="table-name text-truncate" title={dtable.dtableName} aria-label={dtable.dtableName}>{dtable.dtableName}</div>
                  </td>
                  <td>
                    <div className='text-truncate'>{lastSyncTime ? dayjs(lastSyncTime).format('YYYY-MM-DD HH:mm:ss') : ''}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  render() {
    const { isSyncing, isLoading, syncImportDtableIds } = this.state;
    return (
      <Modal isOpen={true} toggle={this.toggle} className="force-sync-common-dataset">
        <DTableModalHeader toggle={this.toggle}>
          {gettext('Force synchronization with common dataset')}
        </DTableModalHeader>
        <ModalBody>
          {isLoading ? <Loading/> : this.renderDtables()}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.props.toggle}>{gettext('Cancel')}</Button>
          <Button color='primary' onClick={this.forceSyncCommonDataset} disabled={isSyncing || isLoading || syncImportDtableIds.length === 0}>{gettext('Force sync')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

ForceSyncCommonDatasetDialog.propTypes = propTypes;

export default ForceSyncCommonDatasetDialog;
