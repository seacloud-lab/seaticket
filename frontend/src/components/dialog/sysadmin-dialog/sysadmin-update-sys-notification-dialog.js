import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter, Form, FormGroup, Input } from 'reactstrap';
import { gettext } from '../../../constants';
import ModalHeader from '../../modal-header';

const propTypes = {
  item: PropTypes.object.isRequired,
  toggle: PropTypes.func.isRequired,
  updateNotification: PropTypes.func.isRequired,
  msg: PropTypes.string,
};

class SysAdminUpdateSysNotificationDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      value: this.props.msg,
      isSubmitBtnActive: false
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
    this.props.updateNotification(this.props.item.id, this.state.value.trim());
  };

  toggle = () => {
    this.props.toggle();
  };

  render() {
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <ModalHeader toggle={this.toggle}>{gettext('Modify notification')}</ModalHeader>
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

SysAdminUpdateSysNotificationDialog.propTypes = propTypes;

export default SysAdminUpdateSysNotificationDialog;
