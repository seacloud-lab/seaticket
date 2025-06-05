import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { List, InputItem } from 'antd-mobile';
import { Alert, Button } from 'reactstrap';
import { toaster, DTableRadio } from 'dtable-ui-component';
import MobileCommonHeader from '../mobile-common-header';
import PasswordProtection from './password-protection';
import ExpireDays from './expire-days';
import { Utils } from '../../../../utils/utils';
import { dtableWebAPI } from '../../../../api/dtable-web-api';
import {
  gettext,
  shareLinkExpireDaysMax,
  shareLinkExpireDaysMin,
  shareLinkExpireDaysDefault
} from '../../../../utils/constants';

const Item = List.Item;

const propTypes = {
  currentTable: PropTypes.object,
  toggle: PropTypes.func.isRequired,
  addExternalLink: PropTypes.func.isRequired
};

class AddExternalLink extends React.Component {

  constructor(props) {
    super(props);

    this.isExpireDaysNoLimit = !this.isExpireDaysHasLimit();

    this.state = {
      isSelectedPassword: false,
      isPasswordVisible: false,
      isShowExpiredInput: false,
      password: '',
      expireDays: this.isExpireDaysNoLimit ? '' : (shareLinkExpireDaysDefault || ''),
      radioCheckName: 'default',
      customToken: '',
      errMessage: null
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

  onChangeRadioCheckedName = (name) => {
    this.setState({
      radioCheckName: name
    });
  };

  onCustomTokenInputChange = (value) => {
    this.setState({ customToken: value });
  };

  addExternalLink = () => {
    let { radioCheckName, customToken, password, expireDays } = this.state;
    const { errMessage } = this.validParams();
    if (errMessage) {
      this.setState({ errMessage });
      return;
    }
    const { workspace_id, name } = this.props.currentTable;
    customToken = radioCheckName === 'customize' ? customToken : '';
    dtableWebAPI.createDTableExternalLink(workspace_id, name, customToken, password, expireDays).then(res => {
      let externalLink = res.data;
      this.props.addExternalLink(externalLink);
      this.toggle();
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  validParams = () => {
    let { radioCheckName, customToken, expireDays } = this.state;
    if (!this.isExpireDaysNoLimit && !expireDays && (shareLinkExpireDaysMin || shareLinkExpireDaysMax)) {
      return { errMessage: gettext('Please enter valid days') };
    }
    if (radioCheckName === 'customize') {
      customToken = customToken.trim();
      if (customToken.length > 100) {
        return { errMessage: gettext('URL is too long.') };
      }
      if (!customToken.trim()) {
        return { errMessage: gettext('Please input custom URL.') };
      }
      if (customToken.search(/^[-0-9a-zA-Z]+$/) === -1) {
        return { errMessage: gettext('URL can only contain alphanumeric characters or single hyphens.') };
      }
    }
    return false;
  };

  render() {
    const { isSelectedPassword, password, isShowExpiredInput, expireDays, radioCheckName, customToken, errMessage } = this.state;
    return (
      <Fragment>
        <div className="mobile-share-table">
          <MobileCommonHeader
            title={gettext('External link')}
            titleClass='mobile-share-header'
            onLeftClick={this.toggle}
            leftName={<i className="dtable-font dtable-icon-return" />}
            rightStyle={{ color: '#ED7109' }}
          />
          <div>
            <div className="external-link-tip">
              {gettext('An external link for a base is a public link that grants read-only access to a base. An external link can also be used to embed a base in a webpage.')}
            </div>
            <List>
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
            <List renderHeader="URL">
              <Item onClick={() => this.onChangeRadioCheckedName('default')}>
                <DTableRadio
                  isChecked={radioCheckName === 'default'}
                  label={gettext('Random URL')}
                />
              </Item>
              <Item onClick={() => this.onChangeRadioCheckedName('customize')}>
                <DTableRadio
                  isChecked={radioCheckName === 'customize'}
                  onCheckedChange={() => this.onChangeRadioCheckedName('customize')}
                  label={gettext('Custom URL')}
                />
              </Item>
            </List>

            {radioCheckName === 'customize' &&
              <Fragment>
                <List renderHeader={gettext('Custom URL')}>
                  <InputItem value={customToken} onChange={this.onCustomTokenInputChange} />
                </List>
                <span className="ml-4 mt-2 d-inline-block" style={{ color: '#ccc' }}>
                  {gettext('URL can only contain alphanumeric characters or single hyphens.')}
                </span>
              </Fragment>
            }
          </div>
          {errMessage && <Alert color="danger" className="mt-2">{errMessage}</Alert>}
          <Button color="primary" className="add-external-link" onClick={this.addExternalLink} >{gettext('Generate')}</Button>
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
      </Fragment>
    );
  }
}

AddExternalLink.propTypes = propTypes;

export default AddExternalLink;
