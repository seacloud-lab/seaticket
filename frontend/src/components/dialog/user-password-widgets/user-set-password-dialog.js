import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button, Form, Alert } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import PasswordInput from './password-input';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { gettext } from '../../../utils/constants';
import { Utils, validatePassword } from '../../../utils/utils';
import { DTableModalHeader } from 'dtable-ui-component';

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
    if (!validatePassword(password)) {
      setErrorMessage(gettext('Password strength should be strong or very strong'));
      return;
    }

    setErrorMessage('');
    setCanSubmit(false);
    dtableWebAPI.resetPassword(null, password).then(() => {
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
      <DTableModalHeader toggle={toggle}>{gettext('Set password')}</DTableModalHeader>
      <ModalBody>
        <Form>
          <PasswordInput
            shouldAutoFocus={true}
            value={password}
            labelValue={gettext('Password')}
            onChangeValue={setPassword}
          />
          <PasswordInput
            value={confirmedPassword}
            labelValue={gettext('Confirm password')}
            onChangeValue={setConfirmedPassword}
            enableCheckStrength={false}
          />
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
