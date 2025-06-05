import React from 'react';
import PropTypes from 'prop-types';
import { Progress } from 'react-sweet-progress';
import { toaster, DTableModalHeader } from 'dtable-ui-component';
import { Modal, ModalBody } from 'reactstrap';
import { gettext } from '../../../utils/constants';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import Loading from '../../../components/loading';
import { Utils } from '../../../utils/utils';

import 'react-sweet-progress/lib/style.css';

const propTypes = {
  dtable: PropTypes.object.isRequired,
  onCopyDTableToggle: PropTypes.func.isRequired,
  onCopyDTable: PropTypes.func,
  password: PropTypes.string,
  currentWorkspace: PropTypes.object,
};

class CopyToCurrentGroupDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      options: [],
      password: '',
      isPasswordVisible: true,

      isShowCopyProcess: false,
      totalAssets: 0,
      copiedAssets: 0,
      isCopyingAssets: false,
      doneCopy: false,
    };
    this.timer = null;
  }

  componentDidMount() {
    this.copy();
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

  copy = () => {
    let { dtable, password, currentWorkspace } = this.props;
    let taskId = '';
    let newDtable = '';
    this.openCopyDTableProcess();
    let total;
    let done;
    // Copy Dtable: 1. Copy table content 2. Copy assets(attachments)
    dtableWebAPI.copyDTable(dtable.workspace_id, currentWorkspace.id, dtable.name, password.trim()).then((res) => {
      taskId = res.data.task_id || '';
      newDtable = res.data.dtable;
      if (!taskId){
        toaster.success(gettext('Successfully copy {name}').replace('{name}', newDtable.name));
        this.props.onCopyDTable(newDtable);
        this.closeCopyDTableProcess();
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

  render() {
    let { isCopyingAssets } = this.state;
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
}

CopyToCurrentGroupDialog.propTypes = propTypes;

export default CopyToCurrentGroupDialog;
