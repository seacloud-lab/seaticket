import React from 'react';
import PropTypes from 'prop-types';
import { Label, Input, FormGroup } from 'reactstrap';
import { DTableSelect, DTableRadio } from 'dtable-ui-component';
import { gettext } from '../../../../utils/constants';
import OptionUtils from '../../../../utils/option-utils';
import { dtableWebAPI } from '../../../../api/dtable-web-api';

class SendDingtalk extends React.Component {

  constructor(props) {
    super(props);
    const { default_msg, account_id, msg_type, default_title } = props.action;
    this.state = {
      default_msg,
      default_title,
      account_id,
      msg_type,
      accountOptions: [],
      selectedAccount: null,
      isShowDingtalkTitle: msg_type === 'markdown'
    };
  }

  componentDidMount() {
    this.initDingtalkAccount();
  }

  initDingtalkAccount = () => {
    const { dtableUtils } = this.props;
    dtableWebAPI.listThirdPartyAccounts(dtableUtils.config.dtableUuid).then((res) => {
      const accounts = res.data.accounts_list;
      let dingtalkSettings = [];
      if (accounts.length > 0) {
        dingtalkSettings = accounts.filter(account => {
          return account.account_type === 'dingtalk_robot';
        }).map(account => {
          return {
            name: account.account_name,
            key: account.id,
          };
        });
      }
      const accountOptions = OptionUtils.generatorKeyLabelOptions(dingtalkSettings);
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
    const { selectedAccount, default_msg, msg_type, default_title } = this.state;
    const account_id = selectedAccount ? selectedAccount.value : '';
    const title = msg_type === 'text' ? '' : default_title;
    const { action } = this.props;
    const newAction = { ...action, account_id, default_msg, msg_type, default_title: title };
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

  onTitleChanged = (event) => {
    const { default_title } = this.state;
    const value = event.target.value;
    if (default_title === value) return;
    this.updateAction({ default_title: value });
  };

  onAccountChange = (selectedAccount) => {
    this.updateAction({ selectedAccount });
  };

  onMsgTypeChange = (event) => {
    const value = event.target.value;
    if (value === this.state.msg_type) return;
    const isShowDingtalkTitle = value === 'markdown';
    this.updateAction({ msg_type: value, isShowDingtalkTitle });
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
    const { isShowDingtalkTitle, msg_type, default_title, default_msg } = this.state;
    const msgType = msg_type || 'text';
    return (
      <>
        {isShowDingtalkTitle && (
          <div className="form-group settings-item">
            <Label className="item-label">{gettext('Title')}</Label>
            <Input
              type="text"
              value={default_title}
              onChange={this.onTitleChanged}
              onBlur={this.onSaveAction}
              style={{ lineHeight: '2.375rem' }}
            />
          </div>
        )}
        <div className="form-group settings-item">
          <Label className="item-label">{gettext('Content')}</Label>
          <Input
            type="textarea"
            name="text"
            style={{ minHeight: 100 }}
            value={default_msg}
            onChange={this.onMsgChanged}
            onBlur={this.onSaveAction}
          />
          <div className="seatable-tip-default mt-1">
            {gettext('Use {column name} to cite the content of a column')}
          </div>
          <FormGroup check className="dingtalk-msg-type pl-0">
            <DTableRadio
              isChecked={msgType === 'text'}
              label={gettext('Text')}
              name="msg_type"
              value='text'
              onCheckedChange={this.onMsgTypeChange}
            />
            <DTableRadio
              isChecked={msgType === 'markdown'}
              label='Markdown'
              name="msg_type"
              value='markdown'
              onCheckedChange={this.onMsgTypeChange}
            />
          </FormGroup>
        </div>
      </>
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

SendDingtalk.propTypes = {
  action: PropTypes.object.isRequired,
  dtableUtils: PropTypes.object,
  onUpdateAction: PropTypes.func.isRequired,
};

export default SendDingtalk;
