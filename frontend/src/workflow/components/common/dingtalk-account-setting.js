import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup } from 'reactstrap';
import { DTableCustomizeSelect, DTableSwitch } from 'dtable-ui-component';

const gettext = window.gettext;

class DingtalkAccountSettings extends React.Component {

  constructor(props) {
    super(props);
    const { isSendDingtalkMessage } = props;
    this.state = {
      isSendDingtalkMessage: Boolean(isSendDingtalkMessage),
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { isSendDingtalkMessage } = nextProps;
    if (isSendDingtalkMessage !== this.state.isSendDingtalkMessage) {
      this.setState({ isSendDingtalkMessage });
    }
  }

  onSettingUpdate = (account = {}) => {
    const { workflowConfig } = this.props;
    const { id: accountId } = account;
    if (accountId === workflowConfig.dingtalk_account_id) return;
    this.props.onSettingUpdate({
      dingtalk_account_id: accountId,
    });
  };

  onUpdateValue = () => {
    const {
      isSendDingtalkMessage: oldIsSendDingtalkMessage,
      accounts,
    } = this.props;
    const { isSendDingtalkMessage } = this.state;
    if (isSendDingtalkMessage === oldIsSendDingtalkMessage) {
      return;
    }
    this.props.onSettingUpdate({
      is_send_dingtalk_message: isSendDingtalkMessage,
      dingtalk_account_id: accounts.length > 0 ? accounts[0].id : null
    });
  };

  onSendDingtalkMessageChange = () => {
    this.setState({ isSendDingtalkMessage: !this.state.isSendDingtalkMessage }, () => {
      this.onUpdateValue();
    });
  };

  renderSelector = () => {
    const { workflowConfig, accounts, isLocked } = this.props;
    const options = accounts.map((account) => {
      const value = account;
      const label = account.account_name;
      const _id = account.id;
      return { value, label, _id };
    });
    const selectedOption = options.find(item => item._id === workflowConfig.dingtalk_account_id);
    return (
      <DTableCustomizeSelect
        className="workflow-select-table"
        isLocked={isLocked}
        value={selectedOption}
        options={options}
        placeholder={gettext('Select an account')}
        noOptionsPlaceholder={gettext('No accounts')}
        onSelectOption={this.onSettingUpdate}
      />
    );
  };

  render() {
    const { className } = this.props;
    const { isSendDingtalkMessage } = this.state;
    return (
      <div className="table-setting setting-item finish-task-message-settings-container">
        <DTableSwitch
          checked={isSendDingtalkMessage}
          onChange={this.onSendDingtalkMessageChange}
          placeholder={'发送通知到钉钉'}
          switchClassName="form-setting-item"
        />
        {isSendDingtalkMessage &&
          <FormGroup key="page-table" className={`setting-item table-setting settings-select-table ${className}`} >
            <div className="workflow-state-field-tip mb-2">
              {'通过选择第三方集成的钉钉账号, 把工作流变动通知推送到钉钉'}
            </div>
            {this.renderSelector()}
          </FormGroup>
        }
      </div>
    );
  }
}

DingtalkAccountSettings.propTypes = {
  isLocked: PropTypes.bool,
  className: PropTypes.string,
  workflowConfig: PropTypes.object.isRequired,
  accounts: PropTypes.array,
  onSettingUpdate: PropTypes.func.isRequired,
  isSendDingtalkMessage: PropTypes.bool,
};

export default DingtalkAccountSettings;
