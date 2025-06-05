import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../utils/constants';
import ModalPortal from '../../components/modal-portal';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  currentSession: PropTypes.object.isRequired,
  logOutCancel: PropTypes.func.isRequired,
  onLogOutSession: PropTypes.func.isRequired,
};

class LogOutSessionDialog extends React.Component {

  toggle = () => {
    this.props.logOutCancel();
  };

  render() {
    return (
      <ModalPortal>
        <Modal isOpen={true} toggle={this.toggle}>
          <DTableModalHeader toggle={this.toggle}>{gettext('Log out')}</DTableModalHeader>
          <ModalBody>
            <p>{gettext('Are you sure to log out')}{' '}<b>{this.props.currentSession.user_name}</b>?</p>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onMouseDown={this.toggle}>{gettext('Cancel')}</Button>
            <Button color="primary" onMouseDown={this.props.onLogOutSession}>{gettext('Log out')}</Button>
          </ModalFooter>
        </Modal>
      </ModalPortal>
    );
  }
}

LogOutSessionDialog.propTypes = propTypes;

export default LogOutSessionDialog;
