import React from 'react';
import PropTypes from 'prop-types';
import { Label, Input, FormGroup } from 'reactstrap';
import { gettext } from '../../../../utils/constants';
import { DTableSelect, DTableRadio } from 'dtable-ui-component';
import OptionUtils from '../../../../utils/option-utils';
import { dtableWebAPI } from '../../../../api/dtable-web-api';

class SendWechatMessage extends React.Component {

  constructor(props) {
    super(props);
    const { default_msg, account_id, msg_type } = props.action;
    this.state = {
      default_msg,
      account_id,
      msg_type,
      accountOptions: [],
      selectedAccount: null,
    };
  }

  componentDidMount() {
    this.initWechatAccount();
  }

  initWechatAccount = () => {
    const { dtableUtils } = this.props;
    dtableWebAPI.listThirdPartyAccounts(dtableUtils.config.dtableUuid).then((res) => {
      const accounts = res.data.accounts_list;
      let wechatSettings = [];
      if (accounts.length > 0) {
        wechatSettings = accounts.filter(account => {
          return account.account_type === 'wechat_robot';
        }).map(account => {
          return {
            name: account.account_name,
            key: account.id,
          };
        });
      }
      const accountOptions = OptionUtils.generatorKeyLabelOptions(wechatSettings);
      let selectedAccount;
      if (this.state.account_id) {
        selectedAccount = accountOptions.find(format => format.value === this.state.account_id);
      }
      this.setState({
        accountOptions: accountOptions,
        selectedAccount
      });
    });
  };

  onSaveAction = () => {
    const { selectedAccount, default_msg, msg_type } = this.state;
    const account_id = selectedAccount ? selectedAccount.value : '';
    const { action } = this.props;
    const newAction = { ...action, account_id, default_msg, msg_type };
    this.props.onUpdateAction(newAction);
  };

  updateAction = (update = {}) => {
    this.setState(update, () => {
      this.onSaveAction();
    });
  };

  onMsgChanged = (event) => {
    const { default_msg } = this.state;
    const value = event.target.value;
    if (default_msg === value) return;
    this.updateAction({ default_msg: value });
  };

  onAccountChange = (selectedAccount) => {
    this.updateAction({ selectedAccount });
  };

  onMsgTypeChange = (event) => {
    const value = event.target.value;
    if (value === this.state.msg_type) return;
    this.updateAction({ msg_type: value });
  };

  renderAccountSelect = () => {
    return (
      <div className="form-group settings-item">
        <Label className="item-label">{'选择第三方账号'}</Label>
        <DTableSelect
          options={this.state.accountOptions}
          value={this.state.selectedAccount}
          onChange={this.onAccountChange}
          placeholder={gettext('Select accounts')}
          menuPortalTarget={'.workflow-node-action-settings-modal'}
          noOptionsMessage={() => {
            return <span>{gettext('No accounts')}</span>;
          }}
        />
      </div>
    );
  };

  renderMsg = () => {
    const msgType = this.state.msg_type || 'text';

    return (
      <div className="form-group settings-item">
        <Label className="item-label">{gettext('Content')}</Label>
        <Input
          type="textarea"
          name="text"
          style={{ minHeight: 100 }}
          value={this.state.default_msg}
          onChange={this.onMsgChanged}
          onBlur={this.onSaveAction}
        />
        <div className="seatable-tip-default mt-1">
          {gettext('Use {column name} to cite the content of a column')}
        </div>
        <FormGroup check className="wechat-msg-type pl-0">
          <DTableRadio
            isChecked={msgType === 'text'}
            onCheckedChange={this.onMsgTypeChange}
            label={gettext('Text')}
            name="msg_type"
            value='text'
          />
          <DTableRadio
            isChecked={msgType === 'markdown'}
            onCheckedChange={this.onMsgTypeChange}
            label='Markdown'
            name="msg_type"
            value='markdown'
          />
        </FormGroup>
      </div>
    );
  };

  render() {
    return (
      <>
        {this.renderAccountSelect()}
        {this.renderMsg()}
      </>
    );
  }
}

SendWechatMessage.propTypes = {
  action: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  dtableUtils: PropTypes.object,
  onUpdateAction: PropTypes.func.isRequired,
};

export default SendWechatMessage;
