import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../utils/constants';
import { DTableModalHeader } from 'dtable-ui-component';
import { Modal, ModalBody, ModalFooter, Button, Label, FormGroup, InputGroup, Input } from 'reactstrap';
import '../../../css/dtable-set-password-dialog.css';

const propTypes = {
  dtable: PropTypes.object,
  toggle: PropTypes.func,
  onSubmit: PropTypes.func,
};

class CopyDTablePasswordDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isPasswordVisible: true,
      password: '',
    };
  }

  togglePasswordVisible = () => {
    this.setState({ isPasswordVisible: !this.state.isPasswordVisible });
  };

  onPasswordChange = (e) => {
    this.setState({ password: e.target.value });
  };

  handleSubmit = () => {
    this.props.onSubmit(this.state.password.trim());
    this.toggle();
  };

  toggle = () => {
    this.props.toggle();
  };

  render() {
    let { dtable } = this.props;
    let { password, isPasswordVisible } = this.state;
    return (
      <Modal isOpen={true} toggle={this.toggle} size="md" className="dtable-set-password-dialog">
        <DTableModalHeader toggle={this.toggle}>
          <span className="mr-1">{gettext('Password for')}</span>
          <span className="op-target" title={dtable.name}>{dtable.name}</span>
        </DTableModalHeader>
        <ModalBody className='pb-0'>
          <FormGroup>
            <Label>{gettext('Password')}</Label>{' '}<span className="tip">{''}</span>
            <InputGroup>
              <Input
                type={isPasswordVisible ? 'text' : 'password'}
                value={password}
                onChange={this.onPasswordChange}
              />
              <Button onClick={this.togglePasswordVisible}>
                <i className={`dtable-font dtable-icon-eye${isPasswordVisible ? '' : '-slash'}`}></i>
              </Button>
            </InputGroup>
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.handleSubmit} disabled={!password}>
            {gettext('Submit')}
          </Button>
        </ModalFooter>
      </Modal>
    );
  }
}

CopyDTablePasswordDialog.propTypes = propTypes;

export default CopyDTablePasswordDialog;
