import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button } from 'reactstrap';
import { gettext } from '../../../constants';
import { DTableModalHeader } from 'dtable-ui-component';

export default class DeleteDepartmentV2ConfirmDialog extends React.Component {

  static propTypes = {
    node: PropTypes.object,
    toggle: PropTypes.func,
    onDelete: PropTypes.func
  };

  render() {
    const { node, toggle } = this.props;
    return (
      <Modal isOpen={true} toggle={toggle}>
        <DTableModalHeader toggle={toggle}>
          {gettext('Delete department')}
        </DTableModalHeader>
        <ModalBody>
          <p>{gettext('Are you sure to delete')}{' '}<b>{node.name}</b> ?</p>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onMouseDown={toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onMouseDown={this.props.onDelete}>{gettext('Delete')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}
