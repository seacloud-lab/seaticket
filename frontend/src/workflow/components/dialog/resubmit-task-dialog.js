import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext } from '../../../utils/constants';
import { DTableModalHeader } from 'dtable-ui-component';

function ResubmitTaskDialog(props) {

  function onSubmit() {
    props.onSubmit();
    props.onToggle();
  }

  return (
    <Modal isOpen={true} toggle={props.onToggle}>
      <DTableModalHeader toggle={props.onToggle}>
        {gettext('Resubmit task')}
      </DTableModalHeader>
      <ModalBody>
        <div className="h-100 w-100">
          {gettext('Are you sure to resubmit this task?')}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={props.onToggle}>
          {gettext('Cancel')}
        </Button>
        <Button color="primary" onClick={onSubmit}>
          {gettext('Resubmit task')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

ResubmitTaskDialog.propTypes = {
  onToggle: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default ResubmitTaskDialog;
