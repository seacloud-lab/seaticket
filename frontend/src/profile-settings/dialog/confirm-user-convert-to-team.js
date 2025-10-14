import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button } from 'reactstrap';
import { toaster, ModalHeader } from '@/components';
import { gettext, siteRoot } from '@/constants';
import profileSettingsAPI from '../api';
import { Utils } from '@/utils/utils';

const propTypes = {
  toggle: PropTypes.func.isRequired
};

class ConfirmUserConvertToTeam extends Component {

  constructor(props) {
    super(props);
  }

  confirm = () => {
    profileSettingsAPI.userConvertToTeam().then((res) => {
      toaster.success(gettext('Converted to team account'));
      window.location.href = siteRoot + 'org/manage/';
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    const { toggle } = this.props;
    return (
      <Modal centered={true} isOpen={true} toggle={toggle}>
        <ModalHeader toggle={toggle}>{gettext('Convert to team account')}</ModalHeader>
        <ModalBody>
          <p>{gettext('Do you really want to convert to team account?')}</p>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.confirm}>{gettext('Confirm')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

ConfirmUserConvertToTeam.propTypes = propTypes;

export default ConfirmUserConvertToTeam;
