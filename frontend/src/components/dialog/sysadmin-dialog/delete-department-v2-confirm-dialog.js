import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button } from 'reactstrap';
import { gettext } from '../../../utils/constants';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  node: PropTypes.object,
  toggle: PropTypes.func,
  onDelete: PropTypes.func
};

class DeleteDepartmentV2ConfirmDialog extends React.Component {

  constructor(props) {
    super(props);
  }

  toggle = () => {
    this.props.toggle();
  };

  render() {
    const { node } = this.props;
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>
          {gettext('Delete department')}
        </DTableModalHeader>
        <ModalBody>
          <p>{gettext('Are you sure to delete')}{' '}<b>{node.name}</b> ?</p>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onMouseDown={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onMouseDown={this.props.onDelete}>{gettext('Delete')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

DeleteDepartmentV2ConfirmDialog.propTypes = propTypes;

export default DeleteDepartmentV2ConfirmDialog;
