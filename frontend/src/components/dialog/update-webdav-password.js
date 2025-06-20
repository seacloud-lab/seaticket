import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button, Input, InputGroup } from 'reactstrap';
import { gettext } from '../../constants';
import { DTableModalHeader } from 'dtable-ui-component';

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
        <DTableModalHeader toggle={toggle}>{gettext('WebDav password')}</DTableModalHeader>
        <ModalBody>
          <InputGroup className="">
            <Input type={this.state.isPasswordVisible ? 'text' : 'password'} value={this.state.password} onChange={this.handleInputChange} />
            <Button onClick={this.togglePasswordVisible}><i className={`dtable-font ${this.state.isPasswordVisible ? 'dtable-icon-eye' : 'dtable-icon-eye-slash'}`}></i></Button>
            <Button onClick={this.generatePassword}><i className="dtable-font dtable-icon-random-generation"></i></Button>
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
