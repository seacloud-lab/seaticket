import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import isHotkey from 'is-hotkey';
import { gettext } from '../../constants/config';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  currentTable: PropTypes.object.isRequired,
  restoreCancel: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  owner_deleted: PropTypes.bool
};

class RestoreTableDialog extends React.Component {

  componentDidMount() {
    document.addEventListener('keydown', this.onHotKey);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onHotKey);
  }

  onHotKey = (e) => {
    if (isHotkey('enter', e)) {
      this.props.handleSubmit();
    }
  };

  toggle = () => {
    this.props.restoreCancel();
  };

  renderText = () => {
    let currentTable = this.props.currentTable;
    let owner_deleted = this.props.owner_deleted;
    let name = currentTable.name;
    if (owner_deleted) {
      return (
        <p aria-label={gettext('The owner of this base has been deleted. Do you want to restore the base to your account?')}>{gettext('The owner of this base has been deleted. Do you want to restore the base to your account?')}</p>
      );
    } else {
      return (
        <p aria-label={gettext('Are you sure to restore') + ' ' + name}>{gettext('Are you sure to restore')}{' '}<b>{name}</b> ?</p>
      );
    }
  };

  render() {
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>{gettext('Restore base')}</DTableModalHeader>
        <ModalBody>
          {this.renderText()}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.props.handleSubmit}>{gettext('Restore')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

RestoreTableDialog.propTypes = propTypes;

export default RestoreTableDialog;
