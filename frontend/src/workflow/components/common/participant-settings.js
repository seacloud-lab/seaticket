import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Label, FormGroup } from 'reactstrap';
import { CellType, FORMULA_RESULT_TYPE } from 'dtable-utils';
import { DTableSelect, DTableSwitch, toaster } from 'dtable-ui-component';
import AnyUserSelect from '../any-user-select';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { Utils } from '../../../utils/utils';
import { cloudMode, isOrgContext } from '../../../utils/constants';
import { NODE_PARTICIPANTS_TYPE } from '../../constants';
import { Collaborator, CollaboratorOptionItem } from './collaborator';

const gettext = window.gettext;

class ParticipantSettings extends Component {

  constructor(props) {
    super(props);
    this.state = {
      searchKey: '',
      searchedUsers: [],
      isLoading: false
    };
  }

  genSearchedUsers = (searchKey) => {
    dtableWebAPI.searchUsers(searchKey).then(res => {
      if (searchKey !== this.state.searchKey) return;
      this.setState({
        searchedUsers: res.data.users,
        isLoading: false
      });
    }).catch(error => {
      this.setState({ searchedUsers: [], isLoading: false });
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
      this.setState({ isLoading: true });
      this.genSearchedUsers(validSearchKey);
    });
  };

  generatorCollaboratorOptions = (selectedCollaboratorEmails) => {
    const { searchedUsers } = this.state;
    if (!Array.isArray(searchedUsers)) return [];
    return searchedUsers.map((collaborator) => {
      const { email, name } = collaborator;
      const selectedIndex = selectedCollaboratorEmails.findIndex(item => item === email);
      return {
        value: collaborator,
        name: name,
        label: (
          <CollaboratorOptionItem
            collaborator={collaborator}
            isSelected={ selectedIndex > -1 }
          />
        )
      };
    });
  };

  onSelectParticipant = (value) => {
    const { workflowRelatedUsers } = this.props;
    const participants = this.props.value || [];
    let newParticipants = participants.slice(0, );
    const newEmail = value.email;
    const index = newParticipants.indexOf(newEmail);
    if (index === -1) {
      let newRelatedUsers = workflowRelatedUsers.slice(0, );
      newParticipants.push(newEmail);
      if (!newRelatedUsers.find(user => user.email === newEmail)) {
        newRelatedUsers.push(value);
        this.props.updateWorkflowRelatedUsers(newRelatedUsers);
      }
    } else {
      newParticipants.splice(index, 1);
    }
    this.props.onSelectParticipant(newParticipants);
  };

  onSelectParticipants = (values) => {
    const { workflowRelatedUsers } = this.props;
    let newRelatedUsers = workflowRelatedUsers.slice();
    const participants = this.props.value || [];
    let newParticipants = participants.slice(0, );
    Array.isArray(values) && values.forEach(value => {
      const newEmail = value.email;
      const index = newParticipants.indexOf(newEmail);
      if (index === -1) {
        newParticipants.push(newEmail);
        if (!newRelatedUsers.find(user => user.email === newEmail)) {
          newRelatedUsers.push(value);
        }
      }
    });
    this.props.updateWorkflowRelatedUsers(newRelatedUsers);
    this.props.onSelectParticipant(newParticipants);
  };

  onChangeNeedAllParticipantsSubmit = () => {
    this.props.onChangeNeedAllParticipantsSubmit(!this.props.needAllParticipantsSubmit);
  };

  removeOption = (event, email) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    const { workflowRelatedUsers } = this.props;
    const participants = this.props.value || [];
    let newParticipants = participants.slice(0, );
    const index = participants.indexOf(email);
    newParticipants.splice(index, 1);
    newParticipants = newParticipants.filter(tempEmail => workflowRelatedUsers.find(tempColl => tempColl.email === tempEmail));
    this.props.onSelectParticipant(newParticipants);
  };

  onParticipantsTypeChange = (participantsType) => {
    if (participantsType === this.props.participantsType) {
      return;
    }
    this.props.onParticipantsTypeChange(participantsType);
  };

  onNodeParticipantsColumnKeyChange = (option) => {
    const selectedValue = option ? option.value : '';
    this.props.onNodeParticipantsColumnKeyChange(selectedValue);
  };

  genColumnOptions = () => {
    const { dtableUtils, participantsColumnKey } = this.props;
    return dtableUtils.columns.filter(column => {
      if (column.key === participantsColumnKey) return false;
      if ([CellType.COLLABORATOR, CellType.LINK_FORMULA].indexOf(column.type) === -1) return false;
      if (column.type === CellType.LINK_FORMULA) {
        if (!column.data) return false;
        if (column.data && column.data.result_type !== FORMULA_RESULT_TYPE.ARRAY) return false;
        if (column.data.array_type !== CellType.COLLABORATOR) return false;
        return true;
      }
      return true;
    }).map(column => {
      return {
        value: column.key,
        name: column.name,
        label: (
          <div key={column.key}>
            <div className='workflow-app-next-node-name text-truncate'>{column.name}</div>
          </div>
        )
      };
    });
  };

  render() {
    const { value, workflowRelatedUsers, needAllParticipantsSubmit, participantsType, nodeParticipantsColumnKey } = this.props;
    let validParticipants = value || [];
    validParticipants = validParticipants.map(item => {
      return workflowRelatedUsers.find(c => c.email === item);
    }).filter(item => item);
    const { isLoading } = this.state;
    const selectedCollaborators = validParticipants.map(collaborator => {
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
    const collaboratorOptions = this.generatorCollaboratorOptions(value);
    const enableUseDeptBtn = cloudMode && !isOrgContext ? false : true;

    const columnOptions = this.genColumnOptions();
    const selectedColumnOption = columnOptions.find(option => option.value === nodeParticipantsColumnKey);

    return (
      <FormGroup key="participants-settings" className="setting-item table-setting participants-settings">
        <Label>{gettext('Assignee')}</Label>
        <div className='participants-type-container mb-4 d-flex'>
          <div
            className={classnames('participants-type-item', { 'selected-participants-type-item': participantsType === NODE_PARTICIPANTS_TYPE.STATIC })}
            onClick={this.onParticipantsTypeChange.bind(this, NODE_PARTICIPANTS_TYPE.STATIC)}
          >
            {gettext('Static')}
          </div>
          <div
            className={classnames('participants-type-item', { 'selected-participants-type-item': participantsType === NODE_PARTICIPANTS_TYPE.DYNAMIC })}
            onClick={this.onParticipantsTypeChange.bind(this, NODE_PARTICIPANTS_TYPE.DYNAMIC)}
          >
            {gettext('Dynamic')}
          </div>
        </div>
        {participantsType === NODE_PARTICIPANTS_TYPE.STATIC &&
          <AnyUserSelect
            isLoading={isLoading}
            supportMultipleSelect={true}
            enableUseDeptBtn={enableUseDeptBtn}
            value={selectedCollaborators ? { label: (<>{selectedCollaborators}</>) } : {}}
            values={validParticipants}
            options={collaboratorOptions}
            placeholder={gettext('Select User')}
            noOptionsPlaceholder={gettext('No users')}
            asyncLoadOptions={this.onSearchKeyChange}
            onSelectOption={this.onSelectParticipant}
            onSelectOptions={this.onSelectParticipants}
          />
        }
        {participantsType === NODE_PARTICIPANTS_TYPE.DYNAMIC &&
          <>
            <Label>{gettext('Assignee column')}</Label>
            <DTableSelect
              options={columnOptions}
              onChange={this.onNodeParticipantsColumnKeyChange}
              value={selectedColumnOption}
              isClearable={selectedColumnOption ? true : false}
            />
          </>
        }
        <div className="participants-all-assignees-submit mt-3">
          <DTableSwitch
            checked={needAllParticipantsSubmit}
            onChange={this.onChangeNeedAllParticipantsSubmit}
            placeholder={gettext('Need all assignees submit')}
            switchClassName="form-setting-item"
          />
        </div>
      </FormGroup>
    );
  }
}

ParticipantSettings.propTypes = {
  value: PropTypes.array,
  participantsType: PropTypes.string,
  nodeParticipantsColumnKey: PropTypes.string,
  needAllParticipantsSubmit: PropTypes.bool,
  workflowRelatedUsers: PropTypes.array,
  participantsColumnKey: PropTypes.string,
  dtableUtils: PropTypes.object,
  onSelectParticipant: PropTypes.func,
  onChangeNeedAllParticipantsSubmit: PropTypes.func,
  onParticipantsTypeChange: PropTypes.func,
  onNodeParticipantsColumnKeyChange: PropTypes.func,
  updateWorkflowRelatedUsers: PropTypes.func,
};

export default ParticipantSettings;
