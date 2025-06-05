import React, { Component } from 'react';
import PropTypes from 'prop-types';
import deepCopy from 'deep-copy';
import { lang } from '../../../utils/constants';
import { nodeFactory } from '../../utils/utils';
import { INIT_NODES, NODE_TYPE } from '../../constants';
import CommonSettingsComponent from './common-settings-component';
import FormGroupInputSettings from '../common/form-group-input-settings';
import TableSetting from '../common/table-setting';
import StateFieldSetting from '../common/state-field-setting';
import ParticipantsFieldSetting from '../common/participants-field-setting';
import FinishMessageSettings from '../common/finish-message-settings';
import CancelSetting from '../common/cancel-setting';
import WechatAccountSettings from '../common/wechat-account-setting';
import DingtalkAccountSettings from '../common/dingtalk-account-setting';

const gettext = window.gettext;

class WorkflowSettings extends Component {

  onWorkflowTitleChange = (value) => {
    const { workflowConfig } = this.props;
    const newWorkflowConfig = { ...workflowConfig, workflow_name: value };
    this.props.updateWorkflowConfig(newWorkflowConfig);
  };

  // only table and state field
  onSettingUpdate = (update, type) => {
    const { workflowConfig } = this.props;
    const newWorkflowConfig = { ...workflowConfig, ...update };
    this.props.updateWorkflowConfig(newWorkflowConfig, type);
  };

  onFinishMessageSettingsChange = (finishMessageSettings) => {
    const { isSendFinishTaskMessage, finishTaskMessage } = finishMessageSettings;
    const { workflowConfig } = this.props;
    const newWorkflowConfig = {
      ...workflowConfig,
      is_send_finish_task_message: isSendFinishTaskMessage,
      finish_task_message: finishTaskMessage
    };
    this.props.updateWorkflowConfig(newWorkflowConfig);
  };

  onChangeCanCancelTask = (canCancelTask) => {
    const { workflowConfig } = this.props;
    let nodes;
    if (workflowConfig.nodes && workflowConfig.nodes.length > 0) {
      nodes = deepCopy(workflowConfig.nodes);
    }
    if (!nodes || nodes.length === 0) {
      nodes = deepCopy(INIT_NODES);
    }
    if (canCancelTask) {
      const canceledNode = nodes.find(node => node.type === NODE_TYPE.CANCELED);
      if (!canceledNode) {
        nodes.push(nodeFactory(NODE_TYPE.CANCELED, gettext('Canceled')));
      }
    }
    const newWorkflowConfig = {
      ...workflowConfig,
      can_cancel_task: canCancelTask
    };
    if (canCancelTask) {
      newWorkflowConfig.nodes = nodes;
    }
    this.props.updateWorkflowConfig(newWorkflowConfig);
  };

  render() {
    const { workflowConfig, tables, wechatAccounts, dingtalkAccounts } = this.props;

    return (
      <CommonSettingsComponent header={gettext('Workflow settings')}>
        <div className='workflow-app-settings-content'>
          <FormGroupInputSettings
            value={workflowConfig.workflow_name}
            title={gettext('Workflow name')}
            onValueChange={this.onWorkflowTitleChange}
          />
          <div className="workflow-setting-divider"></div>
          <TableSetting
            isLocked={true}
            tables={tables}
            workflowConfig={workflowConfig}
            onSettingUpdate={this.onSettingUpdate}
          />
          <div className="workflow-setting-divider"></div>
          <StateFieldSetting
            isLocked={true}
            tables={tables}
            workflowConfig={workflowConfig}
            onSettingUpdate={this.onSettingUpdate}
          />
          <div className="workflow-setting-divider"></div>
          <ParticipantsFieldSetting
            isLocked={true}
            tables={tables}
            workflowConfig={workflowConfig}
            onSettingUpdate={this.onSettingUpdate}
          />
          <div className="workflow-setting-divider"></div>
          <FinishMessageSettings
            isSendFinishTaskMessage={workflowConfig.is_send_finish_task_message}
            finishTaskMessage={workflowConfig.finish_task_message}
            onFinishMessageSettingsChange={this.onFinishMessageSettingsChange}
          />
          <div className="workflow-setting-divider"></div>
          <CancelSetting
            canCancelTask={workflowConfig.can_cancel_task}
            onChangeCanCancelTask={this.onChangeCanCancelTask}
          />
          {lang === 'zh-cn' &&
            <>
              <div className="workflow-setting-divider"></div>
              <WechatAccountSettings
                isSendWechatMessage={workflowConfig.is_send_wechat_message}
                isLocked={false}
                accounts={wechatAccounts}
                workflowConfig={workflowConfig}
                onSettingUpdate={this.onSettingUpdate}
              />
              <div className="workflow-setting-divider"></div>
              <DingtalkAccountSettings
                isSendDingtalkMessage={workflowConfig.is_send_dingtalk_message}
                isLocked={false}
                accounts={dingtalkAccounts}
                workflowConfig={workflowConfig}
                onSettingUpdate={this.onSettingUpdate}
              />
            </>
          }
        </div>
      </CommonSettingsComponent>
    );
  }
}

WorkflowSettings.propTypes = {
  workflowConfig: PropTypes.object,
  tables: PropTypes.array,
  wechatAccounts: PropTypes.array,
  dingtalkAccounts: PropTypes.array,
  updateWorkflowConfig: PropTypes.func,
};

export default WorkflowSettings;
