import React from 'react';
import PropTypes from 'prop-types';
import { DTableModalHeader } from 'dtable-ui-component';
import { Alert, Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Label, Input, InputGroup } from 'reactstrap';
import SelectEditor from '../../select-editor/select-editor';
import { gettext } from '../../../constants';
import { Utils } from '../../../utils/utils';

import '../../../css/admin-common.css';

const propTypes = {
  dialogTitle: PropTypes.string,
  showRole: PropTypes.bool,
  availableRoles: PropTypes.array,
  toggleDialog: PropTypes.func.isRequired,
  addUser: PropTypes.func.isRequired,
};

class SysAdminAddUserDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      errorMsg: '',
      isPasswordVisible: false,
      password: '',
      passwordAgain: '',
      email: '',
      name: '',
      role: 'default',
      isSubmitBtnActive: false,
    };
  }

  checkSubmitBtnActive = () => {
    const { email, password, passwordAgain } = this.state;
    let btnActive = true;
    if (email !== '' &&
      password !== '' &&
      passwordAgain !== '') {
      btnActive = true;
    } else {
      btnActive = false;
    }
    this.setState({
      isSubmitBtnActive: btnActive
    });
  };

  toggle = () => {
    this.props.toggleDialog();
  };

  togglePasswordVisible = () => {
    this.setState({ isPasswordVisible: !this.state.isPasswordVisible });
  };

  inputPassword = (e) => {
    let passwd = e.target.value.trim();
    this.setState({
      password: passwd,
      errorMsg: ''
    }, this.checkSubmitBtnActive);
  };

  inputPasswordAgain = (e) => {
    let passwd = e.target.value.trim();
    this.setState({
      passwordAgain: passwd,
      errorMsg: ''
    }, this.checkSubmitBtnActive);
  };

  generatePassword = () => {
    let val = Utils.generatePassword(8);
    this.setState({
      password: val,
      passwordAgain: val
    }, this.checkSubmitBtnActive);
  };

  inputEmail = (e) => {
    let email = e.target.value.trim();
    this.setState({
      email: email
    }, this.checkSubmitBtnActive);
  };

  inputName = (e) => {
    let name = e.target.value;
    this.setState({
      name: name
    });
  };

  updateRole = (role) => {
    this.setState({
      role: role
    });
  };

  handleSubmit = () => {
    const { email, password, passwordAgain, name, role } = this.state;
    let newName = name.trim();
    if (password !== passwordAgain) {
      this.setState({ errorMsg: gettext('Passwords do not match.') });
      return;
    }
    let data = {
      email: email,
      name: newName,
      password: password,
      role: role,
    };
    this.props.addUser(data);
    this.toggle();
  };

  translateRoles = (role) => {
    switch (role) {
      case 'default':
        return gettext('Default');
      case 'guest':
        return gettext('Guest');
      default:
        return role;
    }
  };

  render() {
    const { dialogTitle, showRole, availableRoles } = this.props;
    const { errorMsg, isPasswordVisible, email, name, role, password, passwordAgain, isSubmitBtnActive } = this.state;

    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>{dialogTitle || gettext('Add member')}</DTableModalHeader>
        <ModalBody>
          <Form autoComplete="off">
            <FormGroup>
              <Label>{gettext('Email')}</Label>
              <Input value={email} onChange={this.inputEmail} />
            </FormGroup>
            <FormGroup>
              <Label>{gettext('Name(optional)')}</Label>
              <Input type="text" value={name} onChange={this.inputName} />
            </FormGroup>
            {showRole &&
              <FormGroup>
                <Label>
                  {gettext('Role')}
                  <span className="small ml-1 dtable-font dtable-icon-use-help" title={gettext('You can also add a user as a guest, who will not be allowed to create tables and groups.')}></span>
                </Label>
                <SelectEditor
                  isTextMode={false}
                  isEditIconShow={false}
                  options={availableRoles}
                  currentOption={role}
                  onOptionChanged={this.updateRole}
                  translateOption={this.translateRoles}
                />
              </FormGroup>
            }
            <FormGroup>
              <Label>{gettext('Password')}</Label>
              <InputGroup>
                <Input autoComplete="new-password" type={isPasswordVisible ? 'text' : 'password'} value={password || ''} onChange={this.inputPassword} />
                <Button className="mt-0" onClick={this.togglePasswordVisible}><i className={`link-operation-icon dtable-font ${this.state.isPasswordVisible ? 'dtable-icon-eye' : 'dtable-icon-eye-slash'}`}></i></Button>
                <Button className="mt-0" onClick={this.generatePassword}><i className="link-operation-icon dtable-font dtable-icon-random-generation"></i></Button>
              </InputGroup>
            </FormGroup>
            <FormGroup>
              <Label>{gettext('Password again')}</Label>
              <Input type={isPasswordVisible ? 'text' : 'password'} value={passwordAgain || ''} onChange={this.inputPasswordAgain} />
            </FormGroup>
          </Form>
          {errorMsg && <Alert color="danger">{errorMsg}</Alert>}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.handleSubmit} disabled={!isSubmitBtnActive}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

SysAdminAddUserDialog.propTypes = propTypes;

export default SysAdminAddUserDialog;
