import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  plugin: PropTypes.object.isRequired,
  deleteCancel: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
};

class DeletePluginDialog extends React.Component {

  toggle = () => {
    this.props.deleteCancel();
  };

  render() {
    const { plugin } = this.props;

    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>{gettext('Delete plugin')}</DTableModalHeader>
        <ModalBody>
          <p>{gettext('Are you sure to delete')}{' '}<b>{Utils.getPluginName(plugin)}</b> ?</p>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.props.handleSubmit}>{gettext('Delete')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

DeletePluginDialog.propTypes = propTypes;

export default DeletePluginDialog;
