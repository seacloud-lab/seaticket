import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button, Alert, Label, FormGroup, Input } from 'reactstrap';
import { DTableModalHeader } from 'dtable-ui-component';

import '../../css/dialog/add-state-filed-dialog.css';

const gettext = window.gettext;

class AddStateFiledDialog extends Component {

  constructor(props) {
    super(props);
    this.state = {
      fieldName: '',
      errorMessage: '',
    };
  }

  onToggle = () => {
    this.props.onToggle();
  };

  onSubmit = () => {
    const { fieldName } = this.state;
    const { table } = this.props;
    const validFieldName = fieldName.trim();
    const fields = table.columns || [];
    const existField = fields.find(field => field.name === validFieldName);
    if (existField) {
      this.setState({ errorMessage: gettext('There is another field with this name.') });
      return;
    }
    this.props.onSubmit(validFieldName);
    this.onToggle();
  };

  onFieldNameChange = (event) => {
    const newFieldName = event.target.value;
    if (newFieldName === this.state.fieldName) return;
    this.setState({ fieldName: newFieldName });
  };

  onKeyDown = (event) => {
    if (event.keyCode === 13) {
      event.preventDefault();
      this.onSubmit();
    }
  };

  render() {
    const { fieldName, errorMessage } = this.state;

    return (
      <Modal autoFocus={false} toggle={this.onToggle} isOpen={true} className="add-state-field-dialog">
        <DTableModalHeader toggle={this.onToggle} className="add-state-field-header">
          {gettext('Add state field')}
        </DTableModalHeader>
        <ModalBody className="add-state-field-container">
          <FormGroup>
            <Label>{gettext('Name')}</Label>
            <Input
              value={fieldName}
              autoFocus={true}
              onChange={this.onFieldNameChange}
              onKeyDown={this.onKeyDown}
            />
          </FormGroup>
          <FormGroup>
            <Label>{gettext('Field type')}</Label>
            <div className="form-control add-state-field-type-content">
              <i className="dtable-font dtable-icon-single-election workflow-state-field-icon"></i>
              <span>{gettext('Single select')}</span>
            </div>
          </FormGroup>
          {errorMessage && <Alert color="danger" className="mb-0">{errorMessage}</Alert>}
        </ModalBody>
        <ModalFooter className="add-state-field-footer">
          <Button color="secondary" onClick={this.onToggle} >
            {gettext('Cancel')}
          </Button>
          <Button color="primary" disabled={!fieldName} onClick={this.onSubmit}>
            {gettext('Submit')}
          </Button>
        </ModalFooter>
      </Modal>
    );
  }
}

AddStateFiledDialog.propTypes = {
  table: PropTypes.object,
  onToggle: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default AddStateFiledDialog;
