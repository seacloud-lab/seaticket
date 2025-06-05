import React from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { gettext } from '../../../utils/constants';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { Utils } from '../../../utils/utils';
import AnyUserSelect from '../any-user-select';
import { Collaborator, CollaboratorOptionItem } from '../common/collaborator';

class ParticipantsEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    value: [],
  };

  constructor(props) {
    super(props);
    this.state = {
      participants: [],
      isSearchLoading: false,
      searchedUsers: []
    };
  }

  componentDidMount() {
    const { value } = this.props;
    if (!Array.isArray(value) || !value) {
      this.setState({
        participants: []
      });
      return;
    }
    dtableWebAPI.listUserInfo(value).then(res => {
      const participants = res.data.user_list;
      this.setState({ participants: participants });
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      this.setState({ isSearchLoading: false });
    });
  }

  onCommit = () => {
    const { participants } = this.state;
    const { column } = this.props;
    const updated = {
      [column.key]: Array.isArray(participants) ? participants.map(participant => participant.email).filter(item => item) : []
    };
    this.props.onCommit(updated, column.key);
  };

  removeOption = (event, email) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    if (this.props.isSubmitting) return;
    let newParticipants = this.state.participants.slice();
    const index = newParticipants.findIndex(item => item.email === email);
    if (index > -1) {
      newParticipants.splice(index, 1);
    }
    this.setState({ participants: newParticipants }, () => {
      this.onCommit();
    });
  };

  generatorUserOptions = () => {
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
            collaborator={collaborator}
            isSelected={ selectedIndex > -1 }
          />
        )
      };
    });
  };

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

  onSelectParticipant = (value) => {
    if (this.props.isSubmitting) return;
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
    this.setState({ participants: newParticipants }, () => {
      this.onCommit();
    });
  };

  onSelectParticipants = (values) => {
    if (this.props.isSubmitting) return;
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
    this.setState({ participants: newParticipants }, () => {
      this.onCommit();
    });
  };

  render() {
    const { isReadOnly, isSubmitting } = this.props;
    const { isSearchLoading, participants } = this.state;
    const userOptions = this.generatorUserOptions();
    const selectedCollaborators = participants.map(collaborator => {
      const { email } = collaborator || {};
      return (
        <Collaborator
          key={email}
          isShowRemove={!(isReadOnly || isSubmitting)}
          className="select-option-name"
          collaborator={collaborator}
          onRemove={this.removeOption}
        />
      );
    });
    return (
      <div className="d-flex justify-content-between">
        <AnyUserSelect
          isLocked={isReadOnly || isSubmitting}
          isLoading={isSearchLoading}
          supportMultipleSelect={true}
          enableUseDeptBtn={true}
          value={selectedCollaborators ? { label: (<>{selectedCollaborators}</>) } : {}}
          values={participants}
          options={userOptions}
          placeholder={gettext('Select User')}
          noOptionsPlaceholder={gettext('No users')}
          className="dynamic-collaborator-select"
          asyncLoadOptions={this.onSearchKeyChange}
          onSelectOption={this.onSelectParticipant}
          onSelectOptions={this.onSelectParticipants}
        />
      </div>
    );
  }
}

ParticipantsEditor.propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  column: PropTypes.object,
  editorConfig: PropTypes.object,
  onCommit: PropTypes.func,
  updateTabIndex: PropTypes.func,
};

export default ParticipantsEditor;
