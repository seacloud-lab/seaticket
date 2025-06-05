import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext } from '../../../utils/constants';
import { DTableModalHeader } from 'dtable-ui-component';

class CancelTaskDialog extends React.Component {

  onSubmit = () => {
    this.props.onSubmit();
    this.props.onToggle();
  };

  render() {
    return (
      <Modal isOpen={true} toggle={this.props.onToggle}>
        <DTableModalHeader toggle={this.props.onToggle}>
          {gettext('Cancel task')}
        </DTableModalHeader>
        <ModalBody>
          <div className="h-100 w-100">
            {gettext('Are you sure to cancel this task ?')}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.props.onToggle}>
            {gettext('Cancel')}
          </Button>
          <Button color="primary" onClick={this.onSubmit}>
            {gettext('Cancel task')}
          </Button>
        </ModalFooter>
      </Modal>
    );
  }
}

CancelTaskDialog.propTypes = {
  onToggle: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default CancelTaskDialog;
