import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap';
import isHotkey from 'is-hotkey';
import { gettext } from '../../../constants';

const propTypes = {
  currentProject: PropTypes.object.isRequired,
  restoreCancel: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  owner_deleted: PropTypes.bool
};

class RestoreProjectDialog extends React.Component {

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
    let currentProject = this.props.currentProject;
    let owner_deleted = this.props.owner_deleted;
    let name = currentProject.name;
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
        <ModalHeader toggle={this.toggle}>{gettext('Restore base')}</ModalHeader>
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

RestoreProjectDialog.propTypes = propTypes;

export default RestoreProjectDialog;
