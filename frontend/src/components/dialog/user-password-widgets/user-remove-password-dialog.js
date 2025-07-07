import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button } from 'reactstrap';
import { gettext } from '../../../constants';
import { seaQAAPI } from '../../../api/web-api';
import { Utils } from '../../../utils/utils';
import ModalHeader from '../../modal-header';
import toaster from '../../toaster';

const propTypes = {
  toggle: PropTypes.func.isRequired
};

const UserRemovePassword = ({ toggle }) => {

  const removePassword = () => {
    seaQAAPI.removePassword().then(() => {
      toaster.success(gettext('Password removed'));
      location.reload();
      this.props.toggle();
    }).catch((error) => {
      let message = Utils.getErrorMsg(error);
      toaster.danger(message);
    });
  };

  return (
    <Modal centered={true} isOpen={true} toggle={toggle}>
      <ModalHeader toggle={toggle}>{gettext('Remove password')}</ModalHeader>
      <ModalBody>
        <p>{'移除密码后，必须要通过手机验证码登录，或者通过微信/企业微信等第三方账号登录。'}</p>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={toggle}>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={removePassword}>{gettext('Remove')}</Button>
      </ModalFooter>
    </Modal>
  );
};

UserRemovePassword.propTypes = propTypes;

export default UserRemovePassword;
