import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup } from 'reactstrap';
import { DTableCustomizeSelect, DTableSwitch } from 'dtable-ui-component';

const gettext = window.gettext;

class WechatAccountSettings extends React.Component {

  constructor(props) {
    super(props);
    const { isSendWechatMessage } = props;
    this.state = {
      isSendWechatMessage: Boolean(isSendWechatMessage),
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { isSendWechatMessage } = nextProps;
    if (isSendWechatMessage !== this.state.isSendWechatMessage) {
      this.setState({ isSendWechatMessage });
    }
  }

  onSettingUpdate = (account = {}) => {
    const { workflowConfig } = this.props;
    const { id: accountId } = account;
    if (accountId === workflowConfig.account_id) return;
    this.props.onSettingUpdate({
      account_id: accountId,
    });
  };

  onUpdateValue = () => {
    const {
      isSendWechatMessage: oldIsSendWechatMessage,
      accounts,
    } = this.props;
    const { isSendWechatMessage } = this.state;
    if (isSendWechatMessage === oldIsSendWechatMessage) {
      return;
    }
    this.props.onSettingUpdate({
      is_send_wechat_message: isSendWechatMessage,
      account_id: accounts.length > 0 ? accounts[0].id : null
    });
  };

  onSendWechatMessageChange = () => {
    this.setState({ isSendWechatMessage: !this.state.isSendWechatMessage }, () => {
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
    const selectedOption = options.find(item => item._id === workflowConfig.account_id);
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
    const { isSendWechatMessage } = this.state;
    return (
      <div className="table-setting setting-item finish-task-message-settings-container">
        <DTableSwitch
          checked={isSendWechatMessage}
          onChange={this.onSendWechatMessageChange}
          placeholder={'发送通知到企业微信'}
          switchClassName="form-setting-item"
        />
        {isSendWechatMessage &&
          <FormGroup key="page-table" className={`setting-item table-setting settings-select-table ${className}`} >
            <div className="workflow-state-field-tip mb-2">
              {'通过选择第三方集成的企业微信账号, 把工作流变动通知推送到企业微信群组'}
            </div>
            {this.renderSelector()}
          </FormGroup>
        }
      </div>
    );
  }
}

WechatAccountSettings.propTypes = {
  isLocked: PropTypes.bool,
  className: PropTypes.string,
  workflowConfig: PropTypes.object.isRequired,
  accounts: PropTypes.array,
  onSettingUpdate: PropTypes.func.isRequired,
  isSendWechatMessage: PropTypes.bool,
};

export default WechatAccountSettings;
