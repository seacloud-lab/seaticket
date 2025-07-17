import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button, Input, InputGroup } from 'reactstrap';
import { gettext } from '../../constants';
import ModalHeader from '../modal-header';
import IconButton from '../icon-button';

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
      isPasswordVisible: false,
      btnDisabled: false
    };
  }

  submit = () => {
    this.setState({
      btnDisabled: true
    });
    this.props.updatePassword(this.state.password);
  };

  handleInputChange = (e) => {
    let passwd = e.target.value.trim();
    this.setState({ password: passwd });
  };

  togglePasswordVisible = () => {
    this.setState({
      isPasswordVisible: !this.state.isPasswordVisible
    });
  };

  generatePassword = () => {
    let randomPassword = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 8; i++) {
      randomPassword += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    this.setState({
      password: randomPassword,
      isPasswordVisible: true
    });
  };

  render() {
    const { toggle } = this.props;
    return (
      <Modal centered={true} isOpen={true} toggle={toggle}>
        <ModalHeader toggle={toggle}>{gettext('WebDav password')}</ModalHeader>
        <ModalBody>
          <InputGroup className="">
            <Input type={this.state.isPasswordVisible ? 'text' : 'password'} value={this.state.password} onChange={this.handleInputChange} />
            <IconButton className="btn btn-secondary" style={{ height: 42, width: 42 }} onClick={this.togglePasswordVisible} icon={this.state.isPasswordVisible ? 'eye' : 'eye-slash'} />
            <IconButton className="btn btn-secondary" style={{ height: 42, width: 42 }} onClick={this.generatePassword} icon="magic" />
          </InputGroup>
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
