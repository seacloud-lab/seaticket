import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button, Form, Alert, FormGroup, Label } from 'reactstrap';
import { ModalHeader, toaster, PasswordInput } from '@/components';
import profileSettingsAPI from '../api';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { isValidPassword } from '@/utils/validate';

const propTypes = {
  toggle: PropTypes.func,
};

const UserUpdatePassword = ({ toggle }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmedNewPassword, setConfirmedNewPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [canSubmit, setCanSubmit] = useState(true);

  const updatePassword = () => {
    if (!currentPassword) {
      setErrorMessage(gettext('Current password cannot be blank'));
      return;
    }
    if (!newPassword) {
      setErrorMessage(gettext('Password cannot be blank'));
      return;
    }
    if (!confirmedNewPassword) {
      setErrorMessage(gettext('Please enter the password again'));
      return;
    }
    if (newPassword !== confirmedNewPassword) {
      setErrorMessage(gettext('Passwords don\'t match'));
      return;
    }
    if (currentPassword === newPassword) {
      setErrorMessage(gettext('New password cannot be the same as old password'));
    }
    if (!isValidPassword(newPassword)) {
      setErrorMessage(gettext('Password strength should be strong or very strong'));
      return;
    }
    setErrorMessage('');
    setCanSubmit(false);
    profileSettingsAPI.resetPassword(currentPassword, newPassword).then(() => {
      toaster.success(gettext('Password updated'));
      toggle();
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
      setCanSubmit(true);
    });
  };

  return (
    <Modal centered={true} isOpen={true} toggle={toggle}>
      <ModalHeader toggle={toggle}>{gettext('Update password')}</ModalHeader>
      <ModalBody>
        <Form>
          <FormGroup className="password-input-container position-relative">
            <Label>{gettext('Current password')}</Label>
            <PasswordInput autoFocus={true} enableCheckStrength={false} value={currentPassword} onChange={setCurrentPassword} />
          </FormGroup>
          <FormGroup className="password-input-container position-relative">
            <Label>{gettext('New password')}</Label>
            <PasswordInput value={newPassword} onChange={setNewPassword} />
          </FormGroup>
          <FormGroup className="password-input-container position-relative">
            <Label>{gettext('Confirm password')}</Label>
            <PasswordInput enableCheckStrength={false} value={confirmedNewPassword} onChange={setConfirmedNewPassword} />
          </FormGroup>
        </Form>
        {errorMessage && (
          <Alert color='danger'>{errorMessage}</Alert>
        )}
      </ModalBody>
      <ModalFooter>
        <Button color='secondary' onClick={toggle}>{gettext('Cancel')}</Button>
        <Button color="primary" disabled={!canSubmit} onClick={updatePassword}>{gettext('Update')}</Button>
      </ModalFooter>
    </Modal>
  );
};

UserUpdatePassword.propTypes = propTypes;

export default UserUpdatePassword;
