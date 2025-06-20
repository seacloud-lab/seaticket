import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Input } from 'reactstrap';
import { gettext } from '../../../constants';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  name: PropTypes.string,
  toggle: PropTypes.func.isRequired,
  updateName: PropTypes.func.isRequired,
};

class SysAdminSetOrgNameDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      name: this.props.name,
      isSubmitBtnActive: false
    };
  }

  toggle = () => {
    this.props.toggle();
  };

  handleInputChange = (e) => {
    const value = e.target.value.trim();
    this.setState({
      name: value,
      isSubmitBtnActive: value !== ''
    });
  };

  onKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.handleSubmit();
      e.preventDefault();
    }
  };

  handleSubmit = () => {
    this.props.updateName(this.state.name);
    this.toggle();
  };

  render() {
    const { name, isSubmitBtnActive } = this.state;
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>{gettext('Set name')}</DTableModalHeader>
        <ModalBody>
          <Form>
            <FormGroup>
              <Input
                type="text"
                className="form-control"
                value={name}
                onKeyDown={this.onKeyDown}
                onChange={this.handleInputChange}
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.handleSubmit} disabled={!isSubmitBtnActive}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

SysAdminSetOrgNameDialog.propTypes = propTypes;

export default SysAdminSetOrgNameDialog;
