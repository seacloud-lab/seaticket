import React from 'react';
import PropTypes from 'prop-types';
import { DTableModalHeader } from 'dtable-ui-component';
import { Modal, ModalBody, ModalFooter, Button, Label, FormGroup, InputGroup, Input, Alert } from 'reactstrap';
import { gettext } from '../../../../utils/constants';
import { Utils } from '../../../../utils/utils';

import '../../../../css/dtable-set-password-dialog.css';

class DTableModifyPasswordDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isPasswordVisible: false,
      isOldPasswordVisible: false,
      password: '',
      newPassword: '',
      newPasswordConfirm: '',
      errorInfo: ''
    };
  }

  toggleOldPasswordVisible = () => {
    this.setState({ isOldPasswordVisible: !this.state.isOldPasswordVisible });
  };


  togglePasswordVisible = () => {
    this.setState({ isPasswordVisible: !this.state.isPasswordVisible });
  };

  inputPassword = (e) => {
    let password = e.target.value.trim();
    this.setState({ password: password });
  };

  onNewPasswordChange = (e) => {
    const password = e.target.value.trim();
    this.setState({ newPassword: password });
  };

  onNewPasswordConfirmChange = (e) => {
    const password = e.target.value.trim();
    this.setState({ newPasswordConfirm: password });
  };

  generatePassword = () => {
    const password = Utils.generatePassword(8);
    this.setState({
      newPassword: password,
      newPasswordConfirm: password
    });
  };

  validParams = () => {
    const { newPassword, newPasswordConfirm } = this.state;
    if (newPassword !== newPasswordConfirm) {
      this.setState({ errorInfo: gettext('Passwords don\'t match') });
      return false;
    }
    return true;
  };

  handleSubmit = () => {
    const isValid = this.validParams();
    if (!isValid) return;
    const { dtable } = this.props;
    const { password, newPassword } = this.state;
    const { name } = dtable;
    this.props.onHandlePassword(name, 'password_modify', password, newPassword);
  };

  toggle = () => {
    this.props.toggle();
  };

  render() {
    const { dtable } = this.props;
    const { password, newPassword, newPasswordConfirm, errorInfo, isOldPasswordVisible,
      isPasswordVisible } = this.state;

    return (
      <Modal isOpen={true} toggle={this.toggle} size="md" className="dtable-set-password-dialog">
        <DTableModalHeader toggle={this.toggle}>
          <span className="mr-1">{gettext('Modify password for')}</span>
          <span className="op-target" title={dtable.name}>{dtable.name}</span>
        </DTableModalHeader>
        <ModalBody className='pb-0'>
          <FormGroup>
            <Label>{gettext('Old password')}</Label>{' '}<span className="tip">{''}</span>
            <InputGroup>
              <Input
                type={isOldPasswordVisible ? 'text' : 'password'}
                value={password}
                autoComplete="new-password"
                onChange={this.inputPassword}
              />
              <Button onClick={this.toggleOldPasswordVisible}>
                <i className={`dtable-font dtable-icon-eye${isOldPasswordVisible ? '' : '-slash'}`}></i>
              </Button>
            </InputGroup>
          </FormGroup>
          <FormGroup>
            <Label>{gettext('New password')}</Label>{' '}<span className="tip">{''}</span>
            <InputGroup>
              <Input
                type={isPasswordVisible ? 'text' : 'password'}
                value={newPassword}
                autoComplete="new-password"
                onChange={this.onNewPasswordChange}
              />
              <Button onClick={this.togglePasswordVisible}>
                <i className={`dtable-font dtable-icon-eye${isPasswordVisible ? '' : '-slash'}`}></i>
              </Button>
              <Button onClick={this.generatePassword}>
                <i className="dtable-font dtable-icon-random-generation"></i>
              </Button>
            </InputGroup>
          </FormGroup>
          <FormGroup>
            <Label>{gettext('New password confirmation')}</Label>{' '}<span className="tip">{''}</span>
            <InputGroup>
              <Input
                type={isPasswordVisible ? 'text' : 'password'}
                value={newPasswordConfirm}
                autoComplete="new-password"
                onChange={this.onNewPasswordConfirmChange}
              />
            </InputGroup>
          </FormGroup>
          {errorInfo && <Alert color="danger">{errorInfo}</Alert>}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.handleSubmit} disabled={!password || !newPassword || !newPasswordConfirm}>
            {gettext('Submit')}
          </Button>
        </ModalFooter>
      </Modal>
    );
  }
}

DTableModifyPasswordDialog.propTypes = {
  dtable: PropTypes.object,
  toggle: PropTypes.func,
  onHandlePassword: PropTypes.func,
};

export default DTableModifyPasswordDialog;
