import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button, Form, Alert, FormGroup, Label } from 'reactstrap';
import profileSettingsAPI from '../api';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { isValidPassword } from '@/utils/validate';
import { ModalHeader, toaster, PasswordInput } from '@/components';

const propTypes = {
  toggle: PropTypes.func,
};

const UserSetPassword = ({ toggle }) => {
  const [password, setPassword] = useState('');
  const [confirmedPassword, setConfirmedPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [canSubmit, setCanSubmit] = useState(true);

  const submitPassword = () => {
    if (!password) {
      setErrorMessage(gettext('Password cannot be blank'));
      return;
    }
    if (!confirmedPassword) {
      setErrorMessage(gettext('Please enter the password again'));
      return;
    }
    if (password !== confirmedPassword) {
      setErrorMessage(gettext('Passwords don\'t match'));
      return;
    }
    if (!isValidPassword(password)) {
      setErrorMessage(gettext('Password strength should be strong or very strong'));
      return;
    }

    setErrorMessage('');
    setCanSubmit(false);
    profileSettingsAPI.resetPassword(null, password).then(() => {
      toaster.success(gettext('Password set'));
      location.reload();
      toggle();
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
      setCanSubmit(true);
    });
  };

  return (
    <Modal centered={true} isOpen={true} toggle={toggle}>
      <ModalHeader toggle={toggle}>{gettext('Set password')}</ModalHeader>
      <ModalBody>
        <Form>
          <FormGroup className="password-input-container position-relative">
            <Label>{gettext('Password')}</Label>
            <PasswordInput autoFocus={true} value={password} onChange={setPassword} />
          </FormGroup>
          <FormGroup className="password-input-container position-relative">
            <Label>{gettext('Confirm password')}</Label>
            <PasswordInput enableCheckStrength={false} value={confirmedPassword} onChange={setConfirmedPassword} />
          </FormGroup>
        </Form>
        {errorMessage && (
          <Alert color='danger'>{errorMessage}</Alert>
        )}
      </ModalBody>
      <ModalFooter>
        <Button color='secondary' onClick={toggle}>{gettext('Cancel')}</Button>
        <Button color="primary" disabled={!canSubmit} onClick={submitPassword}>{gettext('Set')}</Button>
      </ModalFooter>
    </Modal>
  );
};

UserSetPassword.propTypes = propTypes;

export default UserSetPassword;
