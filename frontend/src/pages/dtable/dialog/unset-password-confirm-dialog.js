import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext } from '../../../utils/constants';
import ModalPortal from '../../../components/modal-portal';
import { DTableModalHeader } from 'dtable-ui-component';

class UnsetPasswordConfirmDialog extends React.Component {

  toggle = () => {
    this.props.unsetPasswordCancel();
  };

  render() {
    const { currentTable } = this.props;

    return (
      <ModalPortal>
        <Modal isOpen={true} toggle={this.toggle}>
          <DTableModalHeader toggle={this.toggle}>{gettext('Unset password')}</DTableModalHeader>
          <ModalBody className="pb-7">
            {gettext('Are you sure to unset password of base')}{' '}<b>{currentTable.name}</b> ?
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
            <Button color="primary" onClick={this.props.onUnsetDTablePassword}>
              {gettext('Confirm')}
            </Button>
          </ModalFooter>
        </Modal>
      </ModalPortal>
    );
  }
}

UnsetPasswordConfirmDialog.propTypes = {
  currentTable: PropTypes.object.isRequired,
  unsetPasswordCancel: PropTypes.func.isRequired,
  onUnsetDTablePassword: PropTypes.func.isRequired,
};

export default UnsetPasswordConfirmDialog;
