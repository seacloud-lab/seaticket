import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Label, Input } from 'reactstrap';
import SelectEditor from '../../components/select-editor';
import { gettext } from '../../constants';
import { Utils } from '../../utils/utils';
import ModalHeader from '../../components/modal-header';
import Icon from '../../components/icon';
import PasswordInput from '../../components/password-input';

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
      isShowPassword: false,
      password: '',
      passwordAgain: '',
      email: '',
      name: '',
      role: 'free',
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

  togglePasswordVisible = (isShowPassword) => {
    this.setState({ isShowPassword });
  };

  inputPassword = (password, isRandomGeneration) => {
    this.setState({ password });
    if (!isRandomGeneration) return;
    this.setState({ passwordAgain: password });
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
      case 'free':
        return gettext('Free');
      case 'starter':
        return gettext('Starter');
      case 'pro':
        return gettext('Pro');
      case 'business':
        return gettext('Business');
      case 'enterprise':
        return gettext('Enterprise');
      default:
        return role;
    }
  };

  render() {
    const { dialogTitle, showRole, availableRoles } = this.props;
    const { errorMsg, isShowPassword, email, name, role, password, passwordAgain, isSubmitBtnActive } = this.state;
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <ModalHeader toggle={this.toggle}>{dialogTitle || gettext('Add member')}</ModalHeader>
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
                  <Icon
                    className="ml-1 seaqa-help-icon"
                    symbol="question-circle-filled"
                    title={gettext('You can also add a user as a guest, who will not be allowed to create projects and groups.')}
                  />
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
              <PasswordInput
                enableCheckStrength={false}
                enableRandomGeneration={true}
                value={password || ''}
                onChange={this.inputPassword}
                onShowChange={this.togglePasswordVisible}
              />
            </FormGroup>
            <FormGroup>
              <Label>{gettext('Password again')}</Label>
              <Input type={isShowPassword ? 'text' : 'password'} value={passwordAgain || ''} onChange={this.inputPasswordAgain} />
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
