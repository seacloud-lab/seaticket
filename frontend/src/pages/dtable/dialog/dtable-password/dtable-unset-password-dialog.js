import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button, Label, InputGroup, Input, Alert, Col } from 'reactstrap';
import { DTableModalHeader } from 'dtable-ui-component';
import { gettext, canRemoveBasePasswordViaPhone, hasBoundPhone } from '../../../../utils/constants';
import { dtableWebAPI } from '../../../../api/dtable-web-api';
import { Utils } from '../../../../utils/utils';

import '../../../../css/dtable-set-password-dialog.css';

class DTableUnsetPasswordDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isPasswordVisible: false,
      password: '',
      errorInfo: '',
      unsetPasswordByPhone: false,
      inputVerifyCode: '',
      isVerifyCodeRequired: false,
      isSendCodeAvailable: true,
      verifyCodeMessage: gettext('Send verify code'),
      intervalCount: 60,
    };
  }

  togglePasswordVisible = () => {
    this.setState({ isPasswordVisible: !this.state.isPasswordVisible });
  };

  onPasswordChange = (e) => {
    const password = e.target.value.trim();
    this.setState({ password });
  };

  handleSubmit = () => {
    const { dtable } = this.props;
    const { password, inputVerifyCode, unsetPasswordByPhone } = this.state;
    const { name } = dtable;
    if (unsetPasswordByPhone) {
      this.props.onHandlePassword(name, 'password_unset_by_phone', null, null, inputVerifyCode);
      return;
    }
    this.props.onHandlePassword(name, 'password_unset', password);
  };

  toggle = () => {
    this.props.toggle();
  };

  onClick = () => {
    this.setState({
      unsetPasswordByPhone: !this.state.unsetPasswordByPhone,
      errorInfo: '',
      inputVerifyCode: '',
      password: '',
    });
  };

  onChangeVerifyCode = (event) => {
    let value = event.target.value.trim();
    this.setState({ inputVerifyCode: value });
  };

  onSendCode = () => {
    this.setState({ errorInfo: '' });
    const smsType = 'dtable_unset_password';
    dtableWebAPI.sendVerifyCode(null, smsType).then((res) => {
      this.setState({
        isVerifyCodeRequired: true,
        isSendCodeAvailable: false,
      });
      this.setSendCodeTimer();
    }).catch((error) => {
      let errMsg = Utils.getErrorMsg(error);
      if (error.response && error.response.status === 429) {
        errMsg = 'Send code too often, please send later.';
      }
      this.setState({
        errorInfo: gettext(errMsg),
      });
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
        let verifyCodeMessage = gettext('Send verify code');
        this.setState({
          verifyCodeMessage: verifyCodeMessage,
          isSendCodeAvailable: true,
          intervalCount: 60,
        });
      }
    }, 1000);
  };

  render() {
    const { dtable } = this.props;
    const { password, isPasswordVisible, errorInfo, unsetPasswordByPhone, inputVerifyCode,
      isVerifyCodeRequired, isSendCodeAvailable, verifyCodeMessage } = this.state;

    let canUnsetPasswordByPhone = canRemoveBasePasswordViaPhone && hasBoundPhone;

    return (
      <Modal isOpen={true} toggle={this.toggle} size="md" className="dtable-set-password-dialog">
        <DTableModalHeader toggle={this.toggle}>
          <span className="mr-1">{gettext('Unset password for')}</span>
          <span className="op-target" title={dtable.name}>{dtable.name}</span>
        </DTableModalHeader>
        <ModalBody className='pb-0'>
          {unsetPasswordByPhone ?
            <div>
              <Col className="col-sm-9 row">
                {isVerifyCodeRequired ?
                  <div className="verify-code-container">
                    <Input className="verify-code" value={inputVerifyCode} onChange={this.onChangeVerifyCode}/>
                    <button className={`col-sm-auto btn btn-outline-${isSendCodeAvailable ? 'custom' : 'disabled' } ${isVerifyCodeRequired ? 'ml-1' : ''}`} onClick={this.onSendCode} disabled={!isSendCodeAvailable}>{verifyCodeMessage}</button>
                  </div>
                  :
                  <button className={`btn btn-outline-${isSendCodeAvailable ? 'primary' : 'disabled' } ${isVerifyCodeRequired ? 'ml-1' : ''}`} onClick={this.onSendCode} disabled={!isSendCodeAvailable}>{verifyCodeMessage}</button>
                }
              </Col>
            </div>
            :
            <div>
              <Label>{gettext('Input current password to unset password')}</Label>{' '}<span className="tip">{''}</span>
              <InputGroup>
                <Input
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={password}
                  autoComplete="new-password"
                  onChange={this.onPasswordChange}
                />
                <Button onClick={this.togglePasswordVisible}>
                  <i className={`dtable-font dtable-icon-eye${isPasswordVisible ? '' : '-slash'}`}></i>
                </Button>
              </InputGroup>
            </div>
          }
          {canUnsetPasswordByPhone &&
            <span className="action-link" onClick={this.onClick}>{unsetPasswordByPhone ?
              gettext('Unset base password by entering old password') : gettext('Unset base password by phone verification code')}
            </span>
          }
          {errorInfo && <Alert color="danger">{errorInfo}</Alert>}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.handleSubmit} disabled={!password && !inputVerifyCode}>
            {gettext('Submit')}
          </Button>
        </ModalFooter>
      </Modal>
    );
  }
}

DTableUnsetPasswordDialog.propTypes = {
  dtable: PropTypes.object,
  toggle: PropTypes.func,
  onHandlePassword: PropTypes.func,
};

export default DTableUnsetPasswordDialog;
