import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { gettext } from '../../../utils/constants';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { Utils } from '../../../utils/utils';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  toggle: PropTypes.func.isRequired
};

const UserRemovePassword = ({ toggle }) => {

  const removePassword = () => {
    dtableWebAPI.removePassword().then(() => {
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
      <DTableModalHeader toggle={toggle}>{gettext('Remove password')}</DTableModalHeader>
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
