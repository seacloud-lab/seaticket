import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../constants/config';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  workspace: PropTypes.object.isRequired,
  leaveCancel: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
};

class LeaveGroupDialog extends React.Component {

  toggle = () => {
    this.props.leaveCancel();
  };

  render() {
    let workspace = this.props.workspace;
    let groupName = workspace.name;

    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>{gettext('Leave group')}</DTableModalHeader>
        <ModalBody>
          <p>{gettext('Are you sure to leave group')}{' '}<b>{groupName}</b> ?</p>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.props.handleSubmit}>{gettext('Confirm')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

LeaveGroupDialog.propTypes = propTypes;

export default LeaveGroupDialog;
