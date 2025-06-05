import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../utils/constants';
import ModalPortal from '../../../components/modal-portal';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  currentTable: PropTypes.object.isRequired,
  deleteCancel: PropTypes.func.isRequired,
  onDeleteDTable: PropTypes.func.isRequired,
};

class DeleteTableDialog extends React.Component {

  toggle = () => {
    this.props.deleteCancel();
  };

  render() {
    return (
      <ModalPortal>
        <Modal isOpen={true} toggle={this.toggle}>
          <DTableModalHeader toggle={this.toggle}>{gettext('Delete base')}</DTableModalHeader>
          <ModalBody>
            <p>{gettext('Are you sure to delete')}{' '}<b>{this.props.currentTable.name}</b> ?</p>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onMouseDown={this.toggle}>{gettext('Cancel')}</Button>
            <Button color="primary" onMouseDown={this.props.onDeleteDTable}>{gettext('Delete')}</Button>
          </ModalFooter>
        </Modal>
      </ModalPortal>
    );
  }
}

DeleteTableDialog.propTypes = propTypes;

export default DeleteTableDialog;
