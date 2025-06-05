import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button } from 'reactstrap';
import { gettext } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  headerText: PropTypes.string.isRequired,
  toggle: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  itemName: PropTypes.string.isRequired,
  isOpen: PropTypes.bool.isRequired,
};

class DeleteConfirmDialog extends Component {

  toggle = () => {
    this.props.toggle();
  };

  onDelete = () => {
    this.props.onDelete();
  };

  render() {
    const { itemName } = this.props;
    const name = '<span class="op-target">' + Utils.HTMLescape(itemName) + '</span>';
    let message = gettext('Are you sure you want to delete %s ?');
    message = message.replace('%s', name);

    return (
      <Modal isOpen={this.props.isOpen} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>{this.props.headerText}</DTableModalHeader>
        <ModalBody>
          <p dangerouslySetInnerHTML={{ __html: message }}></p>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.onDelete}>{gettext('Delete')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

DeleteConfirmDialog.propTypes = propTypes;

export default DeleteConfirmDialog;
