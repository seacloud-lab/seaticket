import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Input, Label, Button, Form, FormGroup, Alert } from 'reactstrap';
import { toaster, DTableModalHeader } from 'dtable-ui-component';
import PasswordInput from './password-input';
import { seaQAAPI } from '../../../api/web-api';
import { gettext, loginUrl } from '../../../utils/constants';
import { Utils, validatePassword } from '../../../utils/utils';

import '../../../css/user-reset-password-dialog.css';

const propTypes = {
  bindPhone: PropTypes.string.isRequired,
  toggle: PropTypes.func.isRequired
};

class UserResetPassword extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      inputVerifyCode: '',
      isVerifyCodeRequired: false,
      isSendCodeAvailable: true,
      verifyCodeMessage: gettext('Send verification code'),
      intervalCount: 60,
      errorMessage: '',
      newPassword: '',
      confirmPassword: '',
    };
  }

  onNewPasswordChange = (value) => {
    this.setState({ newPassword: value });
  };

  onConfirmPasswordChange = (value) => {
    this.setState({ confirmPassword: value });
  };

  onChangeVerifyCode = (e) => {
    this.setState({
      inputVerifyCode: e.target.value
    });
  };

  setSendCodeTimer = () => {
    this.timer = setInterval(() => {
      let { intervalCount } = this.state;
      if (intervalCount) {
        let count = intervalCount - 1;
        let verifyCodeMessage = gettext('Resend after {count}s').replace('{count}', count);
        this.setState({
          intervalCount: count,
          verifyCodeMessage: verifyCodeMessage,
        });
      } else {
        clearInterval(this.timer);
        let verifyCodeMessage = gettext('Send verification code');
        this.setState({
          verifyCodeMessage: verifyCodeMessage,
          isSendCodeAvailable: true,
          intervalCount: 60,
        });
      }
    }, 1000);
  };

  onSendCode = (e) => {
    e.preventDefault();
    let { bindPhone } = this.props;
    seaQAAPI.sendVerifyCode(bindPhone, 'reset_password').then((res) => {
      this.setState({
        isVerifyCodeRequired: true,
        isSendCodeAvailable: false,
      });
      this.setSendCodeTimer();
    }).catch((error) => {
      let message = '';
      if (error.response && error.response.status === 429) {
        message = gettext('Send code too often, please send later.');
      } else {
        message = Utils.getErrorMsg(error);
      }
      toaster.danger(message);
    });
  };

  resetPassword = () => {
    let { newPassword, confirmPassword, inputVerifyCode } = this.state;
    let { bindPhone } = this.props;

    if (!inputVerifyCode) {
      this.setState({ errorMessage: gettext('Verification code invalid.') });
      return;
    }
    if (!newPassword || !confirmPassword) {
      this.setState({ errorMessage: gettext('Please enter password') });
      return;
    }
    if (confirmPassword !== newPassword) {
      this.setState({ errorMessage: gettext('Passwords don\'t match') });
      return;
    }
    if (!validatePassword(newPassword)) {
      this.setState({ errorMessage: gettext('Password strength should be strong or very strong') });
      return;
    }

    seaQAAPI.resetPasswordByPhone(bindPhone, inputVerifyCode, newPassword, confirmPassword).then((res) => {
      if (this.timer) {
        clearInterval(this.timer);
      }
      // reset
      this.setState({
        inputVerifyCode: '',
        verifyCodeMessage: '',
        isVerifyCodeRequired: false,
        isSendCodeAvailable: false,
        intervalCount: 60,
        errorMessage: ''
      });
      location.href = `${loginUrl}`;
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
    });
  };

  render() {
    let { isVerifyCodeRequired, inputVerifyCode, isSendCodeAvailable, verifyCodeMessage, errorMessage,
      newPassword, confirmPassword } = this.state;
    return (
      <Modal isOpen={true} centered={true} toggle={this.props.toggle}>
        <DTableModalHeader toggle={this.props.toggle}>{gettext('Reset password')}</DTableModalHeader>
        <ModalBody>
          <Form autoComplete="off">
            <FormGroup>
              <Label>{gettext('Phone number')}</Label>
              <Input type="text" className="form-control" value={this.props.bindPhone} readOnly disabled />
            </FormGroup>
            <FormGroup>
              <Label>{gettext('Verification code')}</Label>
              <div className="verify-code-container">
                <Input
                  className="verify-code"
                  value={inputVerifyCode}
                  onChange={this.onChangeVerifyCode}
                  placeholder={gettext('Enter verification code')}
                  autoComplete="off"
                />
                <button className={`ml-2 btn operation-item ${isSendCodeAvailable ? 'btn-outline-secondary' : 'btn-outline-secondary disabled' } ${isVerifyCodeRequired ? 'ml-1' : ''}`} onClick={this.onSendCode} disabled={!isSendCodeAvailable}>{verifyCodeMessage}</button>
              </div>
            </FormGroup>
            <PasswordInput
              value={newPassword}
              labelValue={gettext('New password')}
              onChangeValue={this.onNewPasswordChange}
            />
            <PasswordInput
              value={confirmPassword}
              labelValue={gettext('Confirm password')}
              onChangeValue={this.onConfirmPasswordChange}
              enableCheckStrength={false}
            />
          </Form>
          {errorMessage && <Alert color='danger'>{errorMessage}</Alert>}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.props.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" disabled={!inputVerifyCode} onClick={this.resetPassword}>{gettext('Reset')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

UserResetPassword.propTypes = propTypes;

export default UserResetPassword;
