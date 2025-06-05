import React, { Fragment, } from 'react';
import PropTypes from 'prop-types';
import { Label, Input } from 'reactstrap';
import { gettext } from '../../../../utils/constants';
import { DTableSelect } from 'dtable-ui-component';
import OptionUtils from '../../../../utils/option-utils';
import { dtableWebAPI } from '../../../../api/dtable-web-api';

class SendEmail extends React.Component {

  constructor(props) {
    super(props);
    const { default_msg, account_id, subject, send_to, copy_to } = props.action;
    this.state = {
      default_msg,
      account_id,
      subject,
      send_to,
      copy_to,
      accountOptions: [],
      selectedAccount: null,
    };
  }

  componentDidMount() {
    this.initEmailAccount();
  }

  initEmailAccount = () => {
    const { dtableUtils } = this.props;
    dtableWebAPI.listThirdPartyAccounts(dtableUtils.config.dtableUuid).then((res) => {
      const accounts = res.data.accounts_list;
      let wechatSettings = [];
      if (accounts.length > 0) {
        wechatSettings = accounts.filter(account => {
          return account.account_type === 'email';
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
        accountOptions,
        selectedAccount
      });
    });
  };

  onSaveAction = () => {
    const { default_msg, subject, send_to, copy_to, selectedAccount } = this.state;
    const account_id = selectedAccount ? selectedAccount.value : '';
    const { action, } = this.props;
    const newAction = { ...action, account_id, default_msg, subject, send_to, copy_to };
    this.props.onUpdateAction(newAction);
  };

  updateAction = (update = {}) => {
    this.setState(update, () => {
      this.onSaveAction();
    });
  };

  onMsgChanged = (event) => {
    let { default_msg } = this.state;
    let value = event.target.value;
    if (default_msg === value) return;
    this.setState({ default_msg: value });
  };

  onAccountChange = (selectedAccount) => {
    this.updateAction({ selectedAccount });
  };

  onSubjectChange = (event) => {
    const { subject } = this.state;
    const value = event.target.value;
    if (subject === value) return;
    this.updateAction({ subject: value });
  };

  onSendToChange = (event) => {
    const { send_to } = this.state;
    const value = event.target.value;
    if (send_to === value) return;
    this.updateAction({ send_to: value });
  };

  onCopyToChange = (event) => {
    const { copy_to } = this.state;
    const value = event.target.value;
    if (copy_to === value) return;
    this.updateAction({ copy_to: value });
  };

  renderAccountSelect = () => {
    const { accountOptions, selectedAccount } = this.state;
    return (
      <div className="form-group settings-item">
        <Label className="item-label">{gettext('Select third party account')}</Label>
        <DTableSelect
          options={accountOptions}
          value={selectedAccount}
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
    return (
      <Fragment>
        <div className="form-group settings-item">
          <Label className="item-label">{gettext('Subject')}</Label>
          <Input
            type="text"
            name="subject"
            value={this.state.subject}
            onChange={this.onSubjectChange}
            onBlur={this.onSaveAction}
          />
        </div>
        <div className="form-group settings-item">
          <Label className="item-label">{gettext('Send to')}</Label>
          <Input
            type="text"
            name="send_to"
            value={this.state.send_to}
            onChange={this.onSendToChange}
            onBlur={this.onSaveAction}
          />
          <div className="seatable-tip-default mt-1">
            {gettext('Multiple receivers can be split by, use {column name} to cite the content of a column')}
          </div>
        </div>
        <div className="form-group settings-item">
          <Label className="item-label">{gettext('Email copy to') + ` (${gettext('Optional')})`}</Label>
          <Input
            type="text"
            name="copy_to"
            value={this.state.copy_to}
            onChange={this.onCopyToChange}
            onBlur={this.onSaveAction}
          />
          <div className="seatable-tip-default mt-1">
            {gettext('Multiple receivers can be split by, use {column name} to cite the content of a column')}
          </div>
        </div>
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
        </div>
      </Fragment>
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

SendEmail.propTypes = {
  action: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  dtableUtils: PropTypes.object,
  onUpdateAction: PropTypes.func.isRequired,
};

export default SendEmail;
