import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext } from '../../../utils/constants';
import { DTableModalHeader } from 'dtable-ui-component';

class DeleteTaskDialog extends React.Component {

  onSubmit = () => {
    this.props.onSubmit();
    this.props.onToggle();
  };

  render() {
    return (
      <Modal isOpen={true} toggle={this.props.onToggle}>
        <DTableModalHeader toggle={this.props.onToggle}>
          {gettext('Delete task')}
        </DTableModalHeader>
        <ModalBody>
          <div className="h-100 w-100">
            {gettext('Are you sure to delete this task ?')}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.props.onToggle}>
            {gettext('Cancel')}
          </Button>
          <Button color="primary" onClick={this.onSubmit}>
            {gettext('Delete task')}
          </Button>
        </ModalFooter>
      </Modal>
    );
  }
}

DeleteTaskDialog.propTypes = {
  onToggle: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default DeleteTaskDialog;
