import React from 'react';
import PropTypes from 'prop-types';
import { DTableSelect, toaster, DTableSwitch, DTableModalHeader } from 'dtable-ui-component';
import { Progress } from 'react-sweet-progress';
import { Modal, ModalBody, ModalFooter, Button, Label, FormGroup, InputGroup, Input, UncontrolledTooltip } from 'reactstrap';
import { gettext } from '../../../utils/constants';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import Workspace from '../model/workspace';
import Loading from '../../../components/loading';
import { Utils } from '../../../utils/utils';

import 'react-sweet-progress/lib/style.css';
import '../css/copy-dtable-dialog.css';

const username = window.app.pageOptions.username;

const propTypes = {
  dtable: PropTypes.object.isRequired,
  onCopyDTableToggle: PropTypes.func.isRequired,
  onCopyDTable: PropTypes.func,
};

class CopyDTableDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      srcWorkspace: null,
      dstWorkspace: null,
      options: [],
      password: '',
      isPasswordVisible: true,
      isShowCopyProcess: false,
      totalAssets: 0,
      copiedAssets: 0,
      isCopyingAssets: false,
      doneCopy: false,
      isCopyDatasetSyncs: false,
      commonDatasetSyncsCheck: {},
      datasetSyncList: []
    };
    this.timer = null;
  }

  componentDidMount() {
    const { dtable } = this.props;
    dtableWebAPI.listCommonDatasetSyncs(dtable.uuid).then(res => {
      this.setState({ datasetSyncList: res.data.dataset_sync_list });
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
    dtableWebAPI.listWorkspaces().then((res) => {
      const { workspace_list } = res.data;
      let options = [];
      for (let i = 0; i < workspace_list.length; i++) {
        // fetch src workspace
        if (workspace_list[i].id === dtable.workspace_id) {
          this.setState({ srcWorkspace: workspace_list[i] });
        }

        // other groups is not support copy into
        if (workspace_list[i].type !== 'personal' && workspace_list[i].type !== 'group') {
          continue;
        }

        let workspace = new Workspace(workspace_list[i]);
        let option = {
          id: workspace.id,
          name: workspace.name,
          value: workspace,
          label: workspace.type !== 'personal' ? workspace.name : gettext('My bases')
        };
        // personal-workspace or workspace-creator/admin
        if (workspace_list[i].type === 'personal') {
          options.splice(0, 0, option);
        } else if (workspace_list[i].group_owner === username || workspace_list[i].is_admin) {
          options.push(option);
        }
      }
      this.setState({ options });
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }

  componentWillUnmount() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  toggle = () => {
    this.props.onCopyDTableToggle();
  };

  togglePasswordVisible = () => {
    this.setState({ isPasswordVisible: !this.state.isPasswordVisible });
  };

  onPasswordChange = (e) => {
    this.setState({ password: e.target.value });
  };

  openCopyDTableProcess = () => {
    this.setState({ isShowCopyProcess: true });
  };

  closeCopyDTableProcess = () => {
    setTimeout(() => {
      this.toggle();
    }, 1000);
  };

  onSubmit = () => {
    let { dtable } = this.props;
    let { dstWorkspace, password, isCopyDatasetSyncs } = this.state;
    let taskId = '';
    let newDtable = '';
    this.openCopyDTableProcess();
    let total;
    let done;
    // Copy Dtable: 1. Copy table content 2. Copy assets(attachments)
    dtableWebAPI.copyDTable(dtable.workspace_id, dstWorkspace.id, dtable.name, password.trim(), isCopyDatasetSyncs).then((res) => {
      taskId = res.data.task_id || '';
      newDtable = res.data.dtable;
      if (!taskId){
        toaster.success(gettext('Successfully copy {name}').replace('{name}', newDtable.name));
        this.props.onCopyDTable(newDtable);
        this.closeCopyDTableProcess();
        // copy file api in seafile is not synchronous, so copy a base to source workspace, there is not a task id for copy assets
        // so need to call this api too to do something
        dtableWebAPI.doTaskAfterCopyDTable(newDtable.uuid);
        return;
      }
      // Copy assets may take much time, so query the copy progress per 1000ms and show a progress bar
      return dtableWebAPI.queryCopyDTableStatus(taskId);
    }).then((res) => {
      if (!res) return null;
      total = res.data.total;
      done = res.data.done;
      this.setState({
        totalAssets: total,
        copiedAssets: done,
        isCopyingAssets: true,
      });
      if (res.data && res.data.successful === true) {
        this.setState({ doneCopy: true });
        toaster.success(gettext('Successfully copy {name}').replace('{name}', newDtable.name));
        // copy Dtable callback function（updated the bases in the interface）
        this.props.onCopyDTable(newDtable);
        this.closeCopyDTableProcess();
        // Do something after the assets have been copied, such as page design（update page design static image）
        return dtableWebAPI.doTaskAfterCopyDTable(newDtable.uuid);
      }
      this.timer = setInterval(() => {
        dtableWebAPI.queryCopyDTableStatus(taskId).then(res => {
          total = res.data.total;
          done = res.data.done;
          this.setState({
            totalAssets: total,
            copiedAssets: done,
          });
          if (res.data.successful === true) {
            clearInterval(this.timer);
            this.setState({ doneCopy: true });
            this.props.onCopyDTable(newDtable);
            toaster.success(gettext('Successfully copy {name}').replace('{name}', newDtable.name));
            this.closeCopyDTableProcess();
            return dtableWebAPI.doTaskAfterCopyDTable(newDtable.uuid);
          }
        });
      }, 1000);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  getPercent = () => {
    const { copiedAssets, totalAssets, doneCopy } = this.state;
    if (doneCopy) {
      return 100;
    }
    return totalAssets === 0 ? 0 : Math.round(copiedAssets / totalAssets * 100);
  };

  renderHeader = () => {
    let { dtable } = this.props;
    let { isShowCopyProcess } = this.state;
    return (
      <DTableModalHeader toggle={this.toggle}>
        <span className="mr-1">{isShowCopyProcess ? gettext('Copying') : gettext('Copy')}</span>
        <span className="op-target" title={dtable.name}>{dtable.name}</span>
      </DTableModalHeader>
    );
  };

  preCommonDatasetSyncsCheck = () => {
    if (this.state.dstWorkspace) {
      const { dtable } = this.props;
      const { dstWorkspace } = this.state;
      dtableWebAPI.copyDTablePerCDSsCheck(dtable.workspace_id, dtable.name, dstWorkspace.id).then(res => {
        this.setState({ commonDatasetSyncsCheck: res.data.common_dataset_syncs_check });
      }).catch(error => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      });
    }
  };

  onChangeIsCopyDatasetSyncs = () => {
    this.setState({ isCopyDatasetSyncs: !this.state.isCopyDatasetSyncs }, this.preCommonDatasetSyncsCheck);
  };

  onChangeDstWorkspace = (e) => {
    this.setState({ dstWorkspace: e.value }, this.preCommonDatasetSyncsCheck);
  };

  getCDSLength = () => {
    const cdsSync = this.state.commonDatasetSyncsCheck;
    let cdsSyncLen = 0;
    if (cdsSync && Array.isArray(cdsSync.success)) {
      cdsSyncLen += cdsSync.success.length;
    }
    if (cdsSync && Array.isArray(cdsSync.failed)) {
      cdsSyncLen += cdsSync.failed.length;
    }
    return cdsSyncLen;
  };

  render() {
    let { dtable } = this.props;
    let { password, isPasswordVisible, isCopyingAssets, isShowCopyProcess,
      options, dstWorkspace, isCopyDatasetSyncs, commonDatasetSyncsCheck, datasetSyncList } = this.state;
    let cdsSync = commonDatasetSyncsCheck;

    if (isShowCopyProcess) {
      return (
        <Modal isOpen={true} toggle={this.toggle} size="md">
          {this.renderHeader()}
          <ModalBody style={{ minHeight: '186px' }} className={`${isCopyingAssets ? '' : 'd-flex justify-content-center align-items-center'}`}>
            {isCopyingAssets ?
              <>
                <div className="mb-1 mt-6">{gettext('Copying assets...')}</div>
                <Progress
                  percent={this.getPercent()}
                  theme={{
                    success: {
                      color: '#ED7109'
                    },
                    active: {
                      color: '#ED7109'
                    }
                  }}
                />
              </>
              :
              <div><Loading /></div>
            }
          </ModalBody>
        </Modal>
      );
    }

    return (
      <Modal isOpen={true} toggle={this.toggle} size="md" className="copy-dtable-dialog">
        {this.renderHeader()}
        <ModalBody>
          <FormGroup>
            <Label for="copy-to-group">{gettext('Copy to')}</Label>
            <DTableSelect
              options={options}
              value={options.find(option => option.value === dstWorkspace)}
              noOptionsMessage={() => {return <span>{gettext('No options avaliable')}</span>;}}
              onChange={this.onChangeDstWorkspace}
              menuPortalTarget={null}
              menuPosition="absolute"
              isSearchable={true}
            />
          </FormGroup>
          {dtable.is_encrypted &&
            <FormGroup>
              <Label for="copy-to-group">{gettext('Password')}</Label>
              <InputGroup>
                <Input
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={this.onPasswordChange}
                />
                <Button onClick={this.togglePasswordVisible}>
                  <i className={`dtable-font dtable-icon-eye ${isPasswordVisible ? '' : '-slash'}`}></i>
                </Button>
              </InputGroup>
            </FormGroup>
          }
          {datasetSyncList.length > 0 && dstWorkspace && dstWorkspace.type !== 'personal' &&
            <DTableSwitch
              switchClassName='copy-dtable-dialog-switch'
              placeholder={gettext('Retain link to common dataset')}
              checked={isCopyDatasetSyncs}
              onChange={this.onChangeIsCopyDatasetSyncs}
            />
          }
          {isCopyDatasetSyncs && dstWorkspace && this.getCDSLength() > 0 &&
            <FormGroup className="synced-with-common-datasets mt-4">
              <table className="table-hover">
                <thead>
                  <tr>
                    <th width="35%">{gettext('Common dataset')}</th>
                    <th width="45%">{gettext('Synced with table')}</th>
                    <th width="20%">{/* operations */}</th>
                  </tr>
                </thead>
                <tbody>
                  {cdsSync.success.map((sync, index) => {
                    return (
                      <tr key={index}>
                        <td className='text-truncate'>
                          <span className="synced-dataset-name">{sync.dataset_name}</span>
                        </td>
                        <td className='text-truncate'>
                          <span className="dtable-font dtable-icon-database mr-2"></span>
                          <span className="synced-table-name">{sync.src_table_name}</span>
                        </td>
                        <td></td>
                      </tr>
                    );
                  })}
                  {cdsSync.failed.map((sync, index) => {
                    return (
                      <tr key={index}>
                        <td className='text-truncate'>
                          <span className="synced-dataset-name">{sync.dataset_name}</span>
                        </td>
                        <td className='text-truncate'>
                          <span className="dtable-font dtable-icon-database mr-2"></span>
                          <span className="synced-table-name">{sync.src_table_name}</span>
                        </td>
                        <td>
                          <span className="dtable-font dtable-icon-exclamation-circle" id={`cds-sync-${index}`}></span>
                          <UncontrolledTooltip placement='bottom' target={`cds-sync-${index}`}>
                            {gettext('The selected group has no access to this common dataset. The new base will have a table {src_table_name}, but the table will not be linked to the common dataset.').replace('{src_table_name}', sync.src_table_name)}
                          </UncontrolledTooltip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </FormGroup>
          }
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.onSubmit} disabled={!dstWorkspace}>{gettext('Copy')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

CopyDTableDialog.propTypes = propTypes;

export default CopyDTableDialog;
