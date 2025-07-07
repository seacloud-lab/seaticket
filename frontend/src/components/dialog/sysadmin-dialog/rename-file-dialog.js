import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Input, InputGroup } from 'reactstrap';
import { gettext } from '../../../constants';
import ModalHeader from '../../modal-header';

const propTypes = {
  toggle: PropTypes.func.isRequired,
  setNewName: PropTypes.func.isRequired,
  oldName: PropTypes.string,
};

class RenameFileDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      newName: this.props.oldName,
      isSubmitBtnActive: false
    };
  }

  toggle = () => {
    this.props.toggle();
  };

  handleNewNameChange = (e) => {
    const value = e.target.value.trim();
    this.setState({
      newName: value,
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
    this.props.setNewName(this.state.newName);
    this.toggle();
  };

  render() {
    const { newName, isSubmitBtnActive } = this.state;
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <ModalHeader toggle={this.toggle}>{gettext('Set new name')}</ModalHeader>
        <ModalBody>
          <Form>
            <FormGroup>
              <InputGroup>
                <Input
                  type="text"
                  className="form-control"
                  value={newName}
                  onKeyDown={this.onKeyDown}
                  onChange={this.handleNewNameChange}
                />
              </InputGroup>
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

RenameFileDialog.propTypes = propTypes;

export default RenameFileDialog;
