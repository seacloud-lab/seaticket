import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button } from 'reactstrap';
import { gettext } from '../constants';
import ModalHeader from '../components/modal-header';
import PasswordInput from '../components/password-input';

const propTypes = {
  password: PropTypes.string.isRequired,
  updatePassword: PropTypes.func.isRequired,
  toggle: PropTypes.func.isRequired
};

class UpdateWebdavPassword extends Component {

  constructor(props) {
    super(props);
    this.state = {
      password: this.props.password,
      btnDisabled: false
    };
  }

  submit = () => {
    this.setState({ btnDisabled: true });
    this.props.updatePassword(this.state.password);
  };

  handleInputChange = (password) => {
    this.setState({ password });
  };

  render() {
    const { toggle } = this.props;
    return (
      <Modal centered={true} isOpen={true} toggle={toggle}>
        <ModalHeader toggle={toggle}>{gettext('WebDav password')}</ModalHeader>
        <ModalBody>
          <PasswordInput value={this.state.password} onChange={this.handleInputChange} autoFocus={true} enableCheckStrength={false} enableRandomGeneration={true} />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.submit} disabled={this.state.btnDisabled}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

UpdateWebdavPassword.propTypes = propTypes;

export default UpdateWebdavPassword;
