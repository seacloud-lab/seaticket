import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../utils/constants';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  currentToken: PropTypes.object.isRequired,
  deleteCancel: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
};

class DeleteTokenDialog extends React.Component {

  toggle = () => {
    this.props.deleteCancel();
  };

  render() {
    let currentToken = this.props.currentToken;
    let app_name = currentToken.app_name;
    let message = gettext('Are you sure to delete token %s ?');
    message = message.replace('%s', '<b>' + app_name + '</b>');
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>{gettext('Delete token')}</DTableModalHeader>
        <ModalBody>
          <p dangerouslySetInnerHTML={{ __html: message }}></p>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.props.handleSubmit}>{gettext('Delete')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

DeleteTokenDialog.propTypes = propTypes;

export default DeleteTokenDialog;
