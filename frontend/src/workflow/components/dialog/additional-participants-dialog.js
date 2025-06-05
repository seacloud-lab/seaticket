import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button, Alert } from 'reactstrap';
import ParticipantsFieldSetting from '../common/participants-field-setting';
import { DTableModalHeader } from 'dtable-ui-component';

const gettext = window.gettext;

class AdditionalParticipantsDialog extends Component {

  constructor(props) {
    super(props);
    const { workflowConfig } = props;
    this.state = {
      workflowConfig: { ...workflowConfig },
      errorMessage: '',
    };
  }

  onToggle = () => {
    this.props.onToggle();
  };

  onSubmit = () => {
    const { workflowConfig: propWorkflowConfig } = this.props;
    const { workflowConfig } = this.state;
    const newWorkflowConfig = { ...propWorkflowConfig, ...workflowConfig };
    this.props.onSubmit(newWorkflowConfig);
    this.onToggle();
  };

  onSettingUpdate = (update) => {
    const { workflowConfig } = this.state;
    this.setState({ workflowConfig: { ...workflowConfig, ...update } });
  };

  onAddParticipantsField = (fieldName, tableName, callback) => {
    const { tables } = this.props;
    const selectedTable = tables.find(table => table.name === tableName);
    if (!selectedTable) return;
    this.props.onAddParticipantsField(fieldName, tableName, (field) => {
      callback && callback(field);
    });
  };

  render() {
    const { workflowConfig, errorMessage } = this.state;
    const { tables } = this.props;

    return (
      <Modal autoFocus={false} toggle={this.onToggle} isOpen={true} className="new-workflow-settings-dialog">
        <DTableModalHeader toggle={this.onToggle} className="new-workflow-settings-header">
          {gettext('Workflow settings')}
        </DTableModalHeader>
        <ModalBody className="new-workflow-settings-container">
          <ParticipantsFieldSetting
            isLocked={false}
            addOptionAble={true}
            tables={tables}
            workflowConfig={workflowConfig}
            onSettingUpdate={this.onSettingUpdate}
            onAddParticipantsField={this.onAddParticipantsField}
          />
          {errorMessage && <Alert color="danger" className="mb-0">{errorMessage}</Alert>}
        </ModalBody>
        <ModalFooter className="new-workflow-settings-footer">
          <Button color="secondary" onClick={this.onToggle} >
            {gettext('Cancel')}
          </Button>
          <Button color="primary" onClick={this.onSubmit}>
            {gettext('Submit')}
          </Button>
        </ModalFooter>
      </Modal>
    );
  }
}

AdditionalParticipantsDialog.propTypes = {
  tables: PropTypes.array,
  workflowConfig: PropTypes.object,
  onToggle: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onAddParticipantsField: PropTypes.func.isRequired,
};

export default AdditionalParticipantsDialog;
