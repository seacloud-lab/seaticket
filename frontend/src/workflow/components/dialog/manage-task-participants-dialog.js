import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { Utils } from '../../../utils/utils';
import { gettext } from '../../../utils/constants';
import AnyUserSelect from '../any-user-select';
import { Collaborator, CollaboratorOptionItem } from '../common/collaborator';
import { DTableModalHeader } from 'dtable-ui-component';

class ManageTaskParticipantsDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchedUsers: [],
      participants: [],
      currentParticipants: [],
      isParticipantsLoading: true,
      isSearchLoading: false,
    };
    this.taskId = props.workflowTask.id;
    const { dtable_workflow } = props.workflowTask;
    this.workflowConfig = JSON.parse(dtable_workflow.workflow_config);
    this.token = dtable_workflow.token;
  }

  componentDidMount() {
    dtableWebAPI.getWorkflowTaskParticipants(this.token, this.taskId).then(res => {
      const { participants } = res.data;
      this.setState({
        participants: participants,
        currentParticipants: participants,
        isParticipantsLoading: false
      });
    }).catch(error => {
      this.setState({ participants: [], isParticipantsLoading: false });
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }

  genSearchedUsers = (searchKey) => {
    dtableWebAPI.searchUsers(searchKey).then(res => {
      if (searchKey !== this.state.searchKey) return;
      this.setState({
        searchedUsers: res.data.users,
        isSearchLoading: false
      });
    }).catch(error => {
      this.setState({ searchedUsers: [], isSearchLoading: false });
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  };

  onSearchKeyChange = (searchKeyKey = '') => {
    const validSearchKey = searchKeyKey.trim();
    if (!validSearchKey) {
      this.setState({ searchedUsers: [] });
      return;
    }
    this.setState({ searchKey: validSearchKey }, () => {
      this.setState({ isSearchLoading: true });
      this.genSearchedUsers(validSearchKey);
    });
  };

  generatorCollaboratorOptions = () => {
    const { searchedUsers, participants } = this.state;
    if (!Array.isArray(searchedUsers)) return [];
    return searchedUsers.map((collaborator) => {
      const { email, name } = collaborator;
      const selectedIndex = participants.findIndex(item => item.email === email);
      return {
        value: collaborator,
        name: name,
        label: (
          <CollaboratorOptionItem
            isSelected={selectedIndex > -1}
            collaborator={collaborator}
          />
        )
      };
    });
  };

  onSelectParticipant = (value) => {
    let newParticipants = this.state.participants.slice();
    const newEmail = value.email;
    const index = newParticipants.findIndex(item => item.email === newEmail);
    if (index !== -1) {
      newParticipants.splice(index, 1);
    } else {
      newParticipants.push({
        name: value.name,
        email: value.email,
        avatar_url: value.avatar_url
      });
    }
    this.setState({ participants: newParticipants });
  };

  onSelectParticipants = (values) => {
    let newParticipants = this.state.participants.slice();
    Array.isArray(values) && values.forEach(value => {
      const newEmail = value.email;
      const index = newParticipants.findIndex(item => item.email === newEmail);
      if (index === -1) {
        newParticipants.push({
          email: value.email,
          name: value.name,
          avatar_url: value.avatar_url
        });
      }
    });
    this.setState({ participants: newParticipants });
  };

  deleteParticipant = (email) => {
    const newParticipants = this.state.participants.filter(item => item.email !== email);
    this.setState({ participants: newParticipants });
  };

  submitParticipants = () => {
    const { participants } = this.state;
    const emails = participants.map(item => item.email);
    dtableWebAPI.updateWorkflowTaskParticipants(this.token, this.taskId, emails).then((res) => {
      toaster.success(gettext('Workflow task participants updated'));
      this.setState({ currentParticipants: res.data.participants }, () => {
        this.toggle();
      });
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  };

  removeOption = (event, email) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    let newParticipants = this.state.participants.slice();
    const index = newParticipants.findIndex(item => item.email === email);
    if (index > -1) {
      newParticipants.splice(index, 1);
    }
    this.setState({ participants: newParticipants });
  };

  toggle = () => {
    const { currentParticipants } = this.state;
    this.props.onUpdateParticipants(currentParticipants);
    this.props.toggle();
  };

  render() {
    const { participants, isSearchLoading } = this.state;
    const collaboratorOptions = this.generatorCollaboratorOptions();
    const selectedCollaborators = participants.map(collaborator => {
      const { email } = collaborator || {};
      return (
        <Collaborator
          key={email}
          isShowRemove={true}
          className="select-option-name"
          collaborator={collaborator}
          onRemove={this.removeOption}
        />
      );
    });
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>
          {gettext('Change assignee')}
        </DTableModalHeader>
        <ModalBody>
          <div className="d-flex justify-content-between">
            <AnyUserSelect
              isLoading={isSearchLoading}
              supportMultipleSelect={true}
              enableUseDeptBtn={true}
              value={selectedCollaborators ? { label: (<>{selectedCollaborators}</>) } : {}}
              values={participants}
              options={collaboratorOptions}
              placeholder={gettext('Select User')}
              noOptionsPlaceholder={gettext('No users')}
              asyncLoadOptions={this.onSearchKeyChange}
              onSelectOption={this.onSelectParticipant}
              onSelectOptions={this.onSelectParticipants}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="primary" disabled={participants.length === 0} onClick={this.submitParticipants}>
            {gettext('Submit')}
          </Button>
        </ModalFooter>
      </Modal>
    );
  }
}

ManageTaskParticipantsDialog.propTypes = {
  workflowTask: PropTypes.object,
  onUpdateParticipants: PropTypes.func,
  toggle: PropTypes.func,
};

export default ManageTaskParticipantsDialog;
