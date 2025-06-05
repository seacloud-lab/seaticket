import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button, Input } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { gettext } from '../../utils/constants';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  contactEmail: PropTypes.string.isRequired,
  toggle: PropTypes.func.isRequired,
  onBind: PropTypes.func.isRequired
};

class SetContactEmailDialog extends Component {

  constructor(props) {
    super(props);
    this.state = {
      newContactEmail: props.contactEmail || '',
      submitted: false,
      submitDisabled: true
    };
  }

  action = () => {
    let { newContactEmail } = this.state;
    newContactEmail = newContactEmail.trim();
    if (!newContactEmail.length){
      toaster.danger(gettext('Email address invalid!'));
      return;
    }

    this.setState({ submitted: true });
    this.props.onBind(newContactEmail, (error) => {
      if (error) {
        this.setState({ submitted: false });
      }
    });
  };

  onKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.action();
    }
  };

  onChange = (e) => {
    this.setState({ newContactEmail: e.target.value }, () => {
      if (this.state.newContactEmail.trim() === this.props.contactEmail || !this.state.newContactEmail.length) {
        this.setState({ submitDisabled: true });
      } else {
        this.setState({ submitDisabled: false });
      }
    });
  };

  render() {
    let { toggle } = this.props;
    let { newContactEmail, submitted, submitDisabled } = this.state;
    return (
      <Modal isOpen={true} toggle={toggle}>
        <DTableModalHeader toggle={toggle}>{gettext('Bind contact email')}</DTableModalHeader>
        <ModalBody>
          <Input
            onKeyDown={this.onKeyDown}
            onChange={this.onChange}
            value={newContactEmail}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.action} disabled={submitted || submitDisabled}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

SetContactEmailDialog.propTypes = propTypes;

export default SetContactEmailDialog;
