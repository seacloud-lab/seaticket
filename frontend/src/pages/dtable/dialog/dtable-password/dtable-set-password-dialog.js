import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { DTableModalHeader } from 'dtable-ui-component';
import { Modal, ModalBody, ModalFooter, Button, Label, FormGroup, InputGroup, Input, Alert } from 'reactstrap';
import { gettext, siteRoot, canRemoveBasePasswordViaPhone, hasBoundPhone } from '../../../../constants/config';
import { Utils } from '../../../../utils/utils';

import '../../../../css/dtable-set-password-dialog.css';

class DTableSetPasswordDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isPasswordVisible: false,
      password: '',
      newPassword: '',
      errorInfo: '',
    };
  }

  togglePasswordVisible = () => {
    this.setState({ isPasswordVisible: !this.state.isPasswordVisible });
  };

  inputPassword = (e) => {
    const password = e.target.value.trim();
    this.setState({ password });
  };

  onNewPasswordChange = (e) => {
    const newPassword = e.target.value.trim();
    this.setState({ newPassword: newPassword });
  };

  generatePassword = () => {
    const password = Utils.generatePassword(8);
    this.setState({
      password: password,
      newPassword: password
    });
  };

  validParams = () => {
    const { password, newPassword } = this.state;
    if (password !== newPassword) {
      this.setState({ errorInfo: gettext('Passwords don\'t match') });
      return false;
    }
    return true;
  };

  handleSubmit = () => {
    const isValid = this.validParams();
    if (!isValid) {
      return;
    }
    const { dtable } = this.props;
    const { password } = this.state;
    const { name } = dtable;
    this.props.onHandlePassword(name, 'password_add', password);
  };

  toggle = () => {
    this.props.toggle();
  };

  render() {
    const { dtable } = this.props;
    const { password, newPassword, errorInfo, isPasswordVisible } = this.state;
    const isShowBind = (canRemoveBasePasswordViaPhone && !hasBoundPhone);

    return (
      <Modal isOpen={true} toggle={this.toggle} size="md" className="dtable-set-password-dialog">
        <DTableModalHeader toggle={this.toggle}>
          <span className="mr-1">{gettext('Set password for')}</span>
          <span className="op-target" title={dtable.name}>{dtable.name}</span>
        </DTableModalHeader>
        {isShowBind ?
          <Fragment>
            <ModalBody>
              <div>{gettext('Please bind phone first')}{': '}<a href={`${siteRoot}profile/`}>{gettext('Personal settings')}</a></div>
            </ModalBody>
            <ModalFooter/>
          </Fragment>
          :
          <Fragment>
            <ModalBody className='pb-0'>
              <FormGroup>
                <Label>{gettext('Password')}</Label>{' '}<span className="tip">{''}</span>
                <InputGroup>
                  <Input
                    type={isPasswordVisible ? 'text' : 'password'}
                    value={password}
                    autoComplete="new-password"
                    onChange={this.inputPassword}
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
                <Label>{gettext('Password again')}</Label>
                <Input
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={newPassword || ''}
                  autoComplete="new-password"
                  onChange={this.onNewPasswordChange}
                />
              </FormGroup>
              {errorInfo && <Alert color="danger">{errorInfo}</Alert>}
            </ModalBody>
            <ModalFooter>
              <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
              <Button color="primary" onClick={this.handleSubmit} disabled={!password || !newPassword}>
                {gettext('Submit')}
              </Button>
            </ModalFooter>
          </Fragment>
        }
      </Modal>
    );
  }
}

DTableSetPasswordDialog.propTypes = {
  dtable: PropTypes.object,
  toggle: PropTypes.func,
  onHandlePassword: PropTypes.func,
};

export default DTableSetPasswordDialog;
