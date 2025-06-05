import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter, Form, FormGroup, Input } from 'reactstrap';
import { gettext } from '../../../utils/constants';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  toggle: PropTypes.func.isRequired,
  addNotification: PropTypes.func,
  userEmail: PropTypes.string,
  userName: PropTypes.string,
};

class SysAdminAddSysUserNotificationDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      value: '',
      isSubmitBtnActive: false,
    };
  }

  handleChange = (e) => {
    const value = e.target.value;
    if (!value.trim()) {
      this.setState({ isSubmitBtnActive: false });
    } else {
      this.setState({ isSubmitBtnActive: true });
    }

    this.setState({ value: value });
  };

  handleSubmit = () => {
    this.toggle();
    this.props.addNotification(this.state.value.trim(), this.props.userEmail);
  };

  toggle = () => {
    this.props.toggle();
  };

  render() {
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>{gettext('Add notification')}{' / '}{this.props.userName}</DTableModalHeader>
        <ModalBody>
          <Form>
            <FormGroup>
              <Input
                type="textarea"
                value={this.state.value}
                onChange={this.handleChange}
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.handleSubmit} disabled={!this.state.isSubmitBtnActive}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

SysAdminAddSysUserNotificationDialog.propTypes = propTypes;

export default SysAdminAddSysUserNotificationDialog;
