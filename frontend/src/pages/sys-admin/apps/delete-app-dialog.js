import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../utils/constants';
import ModalPortal from '../../../components/modal-portal';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  appName: PropTypes.string.isRequired,
  deleteCancel: PropTypes.func.isRequired,
  onDeleteApp: PropTypes.func.isRequired,
};

class DeleteAppDialog extends React.Component {

  toggle = () => {
    this.props.deleteCancel();
  };

  render() {
    return (
      <ModalPortal>
        <Modal isOpen={true} toggle={this.toggle}>
          <DTableModalHeader toggle={this.toggle}>{gettext('Delete app')}</DTableModalHeader>
          <ModalBody>
            <p>{gettext('Are you sure to delete')}{' '}<b>{this.props.appName}</b> ?</p>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onMouseDown={this.toggle}>{gettext('Cancel')}</Button>
            <Button color="primary" onMouseDown={this.props.onDeleteApp}>{gettext('Delete')}</Button>
          </ModalFooter>
        </Modal>
      </ModalPortal>
    );
  }
}

DeleteAppDialog.propTypes = propTypes;

export default DeleteAppDialog;
