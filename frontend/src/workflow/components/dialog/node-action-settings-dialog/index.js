import React from 'react';
import PropTypes from 'prop-types';
import deepCopy from 'deep-copy';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext } from '../../../../utils/constants';
import { DTableModalHeader } from 'dtable-ui-component';
import SendNotice from './send-notice';
import SendEmail from './send-email';
import SendWechat from './send-wechat';
import SendDingtalk from './send-dingtalk';
import LockRecord from './lock-record';
import AddRecord from './add-record';
import UpdateRecord from './update-record';
import LinkRecords from './link-records';
import RunPythonScript from './run-python-script';
import AddOtherTableRecord from './add-other-table-record';
import { NODE_ACTION_TYPE } from '../../../constants';
import { getActionName } from '../../../utils/node-action-utils';

import '../../../css/dialog/node-action-settings-dialog.css';

class NodeActionSettingsDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      action: deepCopy(props.action),
    };
  }

  toggle = () => {
    this.props.onToggle();
  };

  onDeleteAction = (event, action) => {
    this.props.onDeleteAction(event, action);
    this.toggle();
  };

  onUpdateAction = (newAction) => {
    this.setState({ action: newAction });
  };

  onSubmit = () => {
    this.props.onUpdateAction(this.state.action);
    this.toggle();
  };

  renderAction = () => {
    const { dtableUtils, workflowRelatedUsers, workflowConfig } = this.props;
    const columns = dtableUtils.columns || [];
    const { action } = this.state;
    switch (action.type) {
      case NODE_ACTION_TYPE.NOTIFY: {
        return (
          <SendNotice
            action={action}
            index={0}
            columns={columns}
            workflowRelatedUsers={workflowRelatedUsers}
            onUpdateAction={this.onUpdateAction}
          />
        );
      }
      case NODE_ACTION_TYPE.SEND_EMAIL: {
        return (
          <SendEmail
            action={action}
            dtableUtils={dtableUtils}
            onUpdateAction={this.onUpdateAction}
          />
        );
      }
      case NODE_ACTION_TYPE.SEND_WECHAT: {
        return (
          <SendWechat
            action={action}
            dtableUtils={dtableUtils}
            onUpdateAction={this.onUpdateAction}
          />
        );
      }
      case NODE_ACTION_TYPE.SEND_DINGTALK: {
        return (
          <SendDingtalk
            action={action}
            dtableUtils={dtableUtils}
            onUpdateAction={this.onUpdateAction}
          />
        );
      }
      case NODE_ACTION_TYPE.UPDATE_RECORD: {
        return (
          <UpdateRecord
            action={action}
            columns={columns}
            workflowConfig={workflowConfig}
            workflowRelatedUsers={workflowRelatedUsers}
            currentTableID={dtableUtils.selectedTable._id}
            onUpdateAction={this.onUpdateAction}
          />
        );
      }
      case NODE_ACTION_TYPE.ADD_RECORD: {
        return (
          <AddRecord
            action={action}
            columns={columns}
            workflowRelatedUsers={workflowRelatedUsers}
            currentTableID={dtableUtils.selectedTable._id}
            onUpdateAction={this.onUpdateAction}
          />
        );
      }
      case NODE_ACTION_TYPE.LINK_RECORDS: {
        const tables = dtableUtils.tables || [];
        return (
          <LinkRecords
            action={action}
            columns={columns}
            currentTableID={dtableUtils.selectedTable._id}
            tables={tables}
            onUpdateAction={this.onUpdateAction}
          />
        );
      }
      case NODE_ACTION_TYPE.LOCK_RECORD: {
        return (
          <LockRecord
            action={action}
            onUpdateAction={this.onUpdateAction}
          />
        );
      }
      case NODE_ACTION_TYPE.RUN_PYTHON_SCRIPT: {
        const scripts = dtableUtils.scripts || [];
        return (
          <RunPythonScript
            action={action}
            scripts={scripts}
            onUpdateAction={this.onUpdateAction}
          />
        );
      }
      case NODE_ACTION_TYPE.ADD_OTHER_TABLE_RECORD: {
        const tables = dtableUtils.tables || [];
        return (
          <AddOtherTableRecord
            action={action}
            tables={tables}
            workflowRelatedUsers={workflowRelatedUsers}
            currentTableID={dtableUtils.selectedTable._id}
            onUpdateAction={this.onUpdateAction}
          />
        );
      }
      default: {
        return null;
      }
    }
  };

  render() {
    const { action } = this.state;
    return (
      <Modal
        size="lg"
        isOpen={true}
        toggle={this.toggle}
        modalClassName="workflow-node-action-settings-modal"
        className="workflow-node-action-settings-dialog"
      >
        <DTableModalHeader toggle={this.toggle}>
          {getActionName(action)}
        </DTableModalHeader>
        <ModalBody className="node-action-settings-body">
          {this.renderAction()}
        </ModalBody>
        <ModalFooter>
          <Button color='secondary' onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color='primary' onClick={this.onSubmit}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

NodeActionSettingsDialog.propTypes = {
  action: PropTypes.object,
  dtableUtils: PropTypes.object,
  workflowConfig: PropTypes.object,
  workflowRelatedUsers: PropTypes.array,
  onToggle: PropTypes.func,
  onDeleteAction: PropTypes.func,
  onUpdateAction: PropTypes.func,
};

export default NodeActionSettingsDialog;
