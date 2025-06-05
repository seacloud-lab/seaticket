import React from 'react';
import PropTypes from 'prop-types';
import { Alert } from 'reactstrap';
import { List, InputItem } from 'antd-mobile';
import MobileCommonHeader from '../mobile-common-header';
import { Utils } from '../../../../utils/utils';
import { gettext, shareLinkPasswordMinLength } from '../../../../utils/constants';

const propTypes = {
  password: PropTypes.string,
  setPassword: PropTypes.func,
  toggle: PropTypes.func.isRequired
};

class PasswordProtection extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      password: props.password || '',
      passwdnew: props.password || '',
      isPasswordVisible: false,
      errorMessage: null
    };
  }

  toggle = () => {
    this.props.toggle();
  };

  togglePasswordVisible = () => {
    this.setState({ isPasswordVisible: !this.state.isPasswordVisible });
  };

  inputPassword = (value) => {
    this.setState({ password: value, errorMessage: null });
  };

  generatePassword = () => {
    let val = Utils.generatePassword(shareLinkPasswordMinLength);
    this.setState({
      password: val,
      passwdnew: val,
      errorMessage: null
    });
  };

  inputPasswordNew = (value) => {
    this.setState({ passwdnew: value, errorMessage: null });
  };

  onAddPassword = () => {
    const { password, passwdnew } = this.state;
    if (!password && !passwdnew) {
      this.props.setPassword(password);
      this.toggle();
      return;
    }
    const { errorMessage } = this.validParams();
    if (errorMessage) {
      this.setState({ errorMessage });
      return;
    }

    this.props.setPassword(password);
    this.toggle();
  };

  validParams = () => {
    let { password, passwdnew } = this.state;
    if (password.length === 0) {
      return { errorMessage: gettext('Please enter password') };
    }
    if (password.length < shareLinkPasswordMinLength) {
      return { errorMessage: gettext('Password is too short') };
    }
    if (password !== passwdnew) {
      return { errorMessage: gettext('Passwords don\'t match') };
    }
    return false;
  };

  render() {
    const { passwdnew, password, isPasswordVisible, errorMessage } = this.state;
    let passwordLengthTip = gettext('(at least {passwordLength} characters)');
    passwordLengthTip = passwordLengthTip.replace('{passwordLength}', shareLinkPasswordMinLength);
    return (
      <div className="mobile-share-table">
        <MobileCommonHeader
          title={gettext('Add password protection')}
          titleClass='mobile-share-header'
          onLeftClick={this.toggle}
          leftName={gettext('Cancel')}
          rightName={gettext('Done')}
          onRightClick={this.onAddPassword}
          rightStyle={{ color: '#ED7109' }}
        />
        <List
          renderHeader={
            <span>
              {gettext('Password')}{' '}<span className="tip">{passwordLengthTip}</span>
            </span>}
        >
          <InputItem
            onChange={this.inputPassword}
            value={password}
            type={isPasswordVisible ? 'text' : 'password'}
          />
          <div className="extra-item-container">
            <span className={`extra-item dtable-font dtable-icon-eye${isPasswordVisible ? '' : '-slash'}`} onClick={this.togglePasswordVisible}></span>
            <span className="extra-split-line"></span>
            <span className="extra-item extra-item-random-icon dtable-font dtable-icon-random-generation" onClick={this.generatePassword}></span>
          </div>
        </List>
        <List renderHeader={gettext('Password again')}>
          <InputItem
            onChange={this.inputPasswordNew}
            value={passwdnew}
            type={isPasswordVisible ? 'text' : 'password'}
          />
        </List>
        {errorMessage && <Alert color="danger" className="mt-2">{errorMessage}</Alert>}
      </div>
    );
  }
}

PasswordProtection.propTypes = propTypes;

export default PasswordProtection;
