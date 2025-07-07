import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext } from '../../constants';
import { ModalHeader } from '../../components';

const propTypes = {
  emptyTrashCancel: PropTypes.func.isRequired,
  emptyTrashConfirm: PropTypes.func.isRequired,
};

class EmptyProjectTrashDialog extends React.Component {

  toggle = () => {
    this.props.emptyTrashCancel();
  };

  render() {

    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <ModalHeader toggle={this.toggle}>{gettext('Clean')}</ModalHeader>
        <ModalBody>
          <p aria-label={gettext('Are you sure to clean the trash?')}>{gettext('Are you sure to clean the trash?')}</p>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.props.emptyTrashConfirm}>{gettext('Clean')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

EmptyProjectTrashDialog.propTypes = propTypes;

export default EmptyProjectTrashDialog;
