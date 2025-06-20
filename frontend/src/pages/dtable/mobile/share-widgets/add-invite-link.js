import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { List } from 'antd-mobile';
import { Alert, Button } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import MobileCommonHeader from '../mobile-common-header';
import PasswordProtection from './password-protection';
import ExpireDays from './expire-days';
import { Utils } from '../../../../utils/utils';
import { seaQAAPI } from '../../../../api/web-api';
import {
  gettext,
  shareLinkExpireDaysMax,
  shareLinkExpireDaysMin,
  shareLinkExpireDaysDefault
} from '../../../../constants/config';
import SelectPermission from './select-permission';

const Item = List.Item;

const propTypes = {
  currentTable: PropTypes.object,
  options: PropTypes.array,
  toggle: PropTypes.func.isRequired,
  addInviteLink: PropTypes.func.isRequired
};

class AddInviteLink extends React.Component {

  constructor(props) {
    super(props);

    this.isExpireDaysNoLimit = !this.isExpireDaysHasLimit();
    this.defaultExpireDays = this.isExpireDaysNoLimit ? '' : (shareLinkExpireDaysDefault || '');

    this.state = {
      isSelectedPassword: false,
      isPasswordVisible: false,
      isShowExpiredInput: false,
      isSelectedPermission: false,
      password: '',
      expireDays: this.defaultExpireDays,
      errMessage: null,
      invitePermission: 'rw'
    };
  }

  toggle = () => {
    this.props.toggle();
  };

  onSelectPassword = () => {
    this.setState({
      isSelectedPassword: !this.state.isSelectedPassword
    });
  };

  onSelectPermission = () => {
    this.setState({ isSelectedPermission: !this.state.isSelectedPermission });
  };

  togglePasswordVisible = () => {
    this.setState({ isPasswordVisible: !this.state.isPasswordVisible });
  };

  isExpireDaysHasLimit = () => {
    return !(
      parseInt(shareLinkExpireDaysMin) === 0 &&
      parseInt(shareLinkExpireDaysMax) === 0 &&
      shareLinkExpireDaysDefault === 0
    );
  };

  onExpireChecked = () => {
    this.setState({ isShowExpiredInput: !this.state.isShowExpiredInput });
  };

  setPassword = (value) => {
    this.setState({ password: value });
  };

  setExpireDays = (value) => {
    this.setState({ expireDays: value });
  };

  setPermission = (value) => {
    this.setState({ invitePermission: value });
  };

  addInviteLink = () => {
    let { invitePermission, password, expireDays } = this.state;
    const { errMessage } = this.validParams();
    if (errMessage) {
      this.setState({ errMessage });
      return;
    }
    const { workspace_id, name } = this.props.currentTable;
    seaQAAPI.createDTableInviteLink(workspace_id, name, invitePermission, password, expireDays).then(res => {
      let inviteLink = res.data;
      this.props.addInviteLink(inviteLink);
      this.toggle();
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  validParams = () => {
    let { expireDays } = this.state;
    if (!this.isExpireDaysNoLimit && !expireDays && (shareLinkExpireDaysMin || shareLinkExpireDaysMax)) {
      return { errMessage: gettext('Please enter valid days') };
    }
    return false;
  };

  render() {
    const { isSelectedPassword, password, isShowExpiredInput, expireDays, errMessage, invitePermission,
      isSelectedPermission } = this.state;
    let permissionTip = Utils.sharePerms(invitePermission);
    return (
      <Fragment>
        <div className="mobile-share-table">
          <MobileCommonHeader
            title={gettext('Invite link')}
            titleClass='mobile-share-header'
            onLeftClick={this.toggle}
            leftName={<i className="dtable-font dtable-icon-return" />}
            rightStyle={{ color: '#ED7109' }}
          />
          <div className="mt-4">
            <List>
              <Item
                onClick={this.onSelectPermission}
                arrow="horizontal"
                extra={<span>{permissionTip}</span>}
              >
                {gettext('Add permission')}
              </Item>
              <Item
                onClick={this.onSelectPassword}
                arrow="horizontal"
                extra={<span>{password}</span>}
              >
                {gettext('Add password protection')}
              </Item>
              <Item
                arrow="horizontal"
                onClick={this.onExpireChecked}
                extra={<span>{expireDays ? `${expireDays} ${gettext('days')}` : ''}</span>}
              >
                {gettext('Add auto expiration')}
              </Item>
            </List>
          </div>
          {errMessage && <Alert color="danger" className="mt-2">{errMessage}</Alert>}
          <Button color="primary" className="add-external-link" onClick={this.addInviteLink} >{gettext('Generate')}</Button>
        </div>
        {isSelectedPassword &&
          <PasswordProtection
            toggle={this.onSelectPassword}
            setPassword={this.setPassword}
            password={password}
          />
        }
        {isShowExpiredInput &&
          <ExpireDays
            toggle={this.onExpireChecked}
            setExpireDays={this.setExpireDays}
            expireDays={expireDays}
            isExpireDaysNoLimit={this.isExpireDaysNoLimit}
          />
        }
        {isSelectedPermission &&
          <SelectPermission
            toggle={this.onSelectPermission}
            options={this.props.options}
            setPermission={this.setPermission}
          />
        }
      </Fragment>
    );
  }
}

AddInviteLink.propTypes = propTypes;

export default AddInviteLink;
