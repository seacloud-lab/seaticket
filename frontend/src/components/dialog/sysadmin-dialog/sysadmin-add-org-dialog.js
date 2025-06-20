import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Label, Input } from 'reactstrap';
import { gettext } from '../../../constants';
import { validateName } from '../../../utils/utils';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  toggleDialog: PropTypes.func.isRequired,
  addOrg: PropTypes.func.isRequired
};

class SysAdminAddOrgDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      name: '',
      adminEmail: '',
      adminName: '',
      password: '',
      passwordAgain: '',
      errorMsg: '',
      isSubmitBtnActive: false
    };
  }

  checkSubmitBtnActive = () => {
    const { name, adminEmail, password, passwordAgain } = this.state;
    let btnActive = true;
    if (name !== '' &&
      adminEmail !== '' &&
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

  inputPassword = (e) => {
    let passwd = e.target.value.trim();
    this.setState({
      password: passwd
    }, this.checkSubmitBtnActive);
  };

  inputPasswordAgain = (e) => {
    let passwd = e.target.value.trim();
    this.setState({
      passwordAgain: passwd
    }, this.checkSubmitBtnActive);
  };

  inputEmail = (e) => {
    let adminEmail = e.target.value.trim();
    this.setState({
      adminEmail: adminEmail
    }, this.checkSubmitBtnActive);
  };

  inputAdminName = (e) => {
    let adminName = e.target.value.trim();
    this.setState({
      adminName: adminName
    });
  };

  inputName = (e) => {
    let name = e.target.value.trim();
    this.setState({
      name: name
    }, this.checkSubmitBtnActive);
  };

  handleSubmit = () => {
    let { name, adminEmail, adminName, password, passwordAgain } = this.state;
    let response = validateName(name);
    if (!response.isValid) {
      this.setState({ errorMsg: response.message });
      return;
    }
    if (password !== passwordAgain) {
      this.setState({ errorMsg: gettext('Passwords do not match.') });
      return;
    }
    const data = {
      orgName: response.message,
      adminEmail: adminEmail,
      password: password,
      adminName: adminName
    };
    this.props.addOrg(data);
    this.toggle();
  };

  render() {
    const { errorMsg, password, passwordAgain, adminEmail, adminName, name, isSubmitBtnActive } = this.state;
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>{gettext('Add organization')}</DTableModalHeader>
        <ModalBody>
          <Form autoComplete="off">
            <FormGroup>
              <Label>{gettext('Name')}</Label>
              <Input value={name} onChange={this.inputName} />
            </FormGroup>
            <FormGroup>
              <Label>
                {gettext('Admin email')}
              </Label>
              <Input value={adminEmail} onChange={this.inputEmail} />
            </FormGroup>
            <FormGroup>
              <Label>
                {gettext('Admin name')}
              </Label>
              <Input value={adminName} onChange={this.inputAdminName} />
            </FormGroup>
            <FormGroup>
              <Label>{gettext('Password')}</Label>
              <Input type="password" value={password} onChange={this.inputPassword} />
            </FormGroup>
            <FormGroup>
              <Label>{gettext('Password again')}</Label>
              <Input type="password" value={passwordAgain} onChange={this.inputPasswordAgain} />
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

SysAdminAddOrgDialog.propTypes = propTypes;

export default SysAdminAddOrgDialog;
