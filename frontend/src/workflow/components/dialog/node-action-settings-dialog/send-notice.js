import React from 'react';
import PropTypes from 'prop-types';
import { Label, Input, Row, Col } from 'reactstrap';
import { DTableSelect } from 'dtable-ui-component';
import CollaboratorSelect from '../../select/collaborator-select';
import OptionUtils from '../../../../utils/option-utils';
import { gettext } from '../../../../utils/constants';
import { CollaboratorOptionItem, Collaborator } from '../../common/collaborator';

class SendNotice extends React.Component {

  constructor(props) {
    super(props);
    const { action, columns, workflowRelatedUsers } = props;
    const { default_msg, users, users_column_key } = action;
    this.collaboratorColumnOptions = OptionUtils.generatorCollaboratorColumnOptions(columns);
    const collaboratorColumn = (users_column_key && this.collaboratorColumnOptions.find(option => option.value === users_column_key)) || null;
    this.collaborators = workflowRelatedUsers || [];
    this.state = {
      users: this.getValidUsers(users),
      default_msg,
      users_column_key,
      collaboratorColumn,
    };
  }

  getValidUsers = (users) => {
    let validUsers = [];
    this.collaborators.forEach(collaborator => {
      if (users.includes(collaborator.email)) {
        validUsers.push(collaborator);
      }
    });
    return validUsers;
  };

  onSaveAction = () => {
    const { action } = this.props;
    const { users, default_msg, collaboratorColumn } = this.state;
    const userEmails = Array.isArray(users) ? users.map(user => user.email) : [];
    const users_column_key = !collaboratorColumn ? '' : collaboratorColumn.value;
    const newAction = { ...action, users: userEmails, default_msg, users_column_key };
    this.props.onUpdateAction(newAction);
  };

  updateAction = (update = {}) => {
    this.setState(update, () => {
      this.onSaveAction();
    });
  };

  onMsgChanged = (event) => {
    let { default_msg } = this.state;
    let value = event.target.value;
    if (default_msg === value) return;
    this.updateAction({ default_msg: value });
  };

  onUsersChanged = (email) => {
    const { users } = this.state;
    let newUsers = users.slice(0, );
    const index = users.findIndex(item => item.key === email);
    if (index === -1) {
      const user = this.collaborators.find(collaborator => collaborator.email === email);
      if (user) {
        newUsers.push(user);
      }
    } else {
      newUsers.splice(index, 1);
    }
    this.updateAction({ users: newUsers });
  };

  onSelectCollaboratorColumn = (columnOption) => {
    const { collaboratorColumn } = this.state;
    if (columnOption && collaboratorColumn && (columnOption.value === collaboratorColumn.value)) return;
    this.updateAction({ collaboratorColumn: columnOption });
  };

  getCollaboratorOptions = () => {
    let selectedMap = {};
    const { users } = this.state;
    if (Array.isArray(users) && users.length > 0) {
      users.forEach(item => {
        selectedMap[item.key] = true;
      });
    }
    return this.collaborators.map(collaborator => {
      const { email, name, name_pinyin } = collaborator;
      return {
        label: (
          <CollaboratorOptionItem
            isSelected={selectedMap[email]}
            collaborator={collaborator}
          />
        ),
        value: email,
        name,
        name_pinyin,
      };
    });
  };

  onRemoveCollaborator = (event, email) => {
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
    const { users } = this.state;
    let newUsers = users.slice(0, );
    const userIndex = newUsers.findIndex(item => item.key === email);
    newUsers.splice(userIndex, 1);
    this.updateAction({ users: newUsers });
  };

  getSelectedDisplayUsers = (users) => {
    if (!Array.isArray(users) || users.length === 0) return [];
    return users.map(user => {
      const { email } = user;
      return (
        <Collaborator
          key={email}
          isShowRemove={true}
          collaborator={user}
          onRemove={this.onRemoveCollaborator}
        />
      );
    });
  };

  renderUserSelect = () => {
    const { users, collaboratorColumn } = this.state;
    const value = { label: this.getSelectedDisplayUsers(users) };

    return (
      <div className="form-group settings-item">
        <Row>
          <Col md={6}>
            <Label className="item-label">{gettext('Notify to')}</Label>
            <CollaboratorSelect
              supportMultipleSelect={true}
              searchable={true}
              isUsePopover={true}
              className="selector-collaborator"
              placeholder={gettext('Select users')}
              noOptionsPlaceholder={gettext('No users')}
              searchPlaceholder={gettext('Select users')}
              onSelectOption={this.onUsersChanged}
              value={value}
              options={this.getCollaboratorOptions()}
              top={-50}
            />
          </Col>
          <Col md={6}>
            <Label className="item-label">{gettext('Users in column')}</Label>
            <DTableSelect
              isClearable={true}
              value={collaboratorColumn}
              options={this.collaboratorColumnOptions}
              placeholder={gettext('Select a column')}
              onChange={this.onSelectCollaboratorColumn}
              menuPortalTarget={'.workflow-node-action-settings-modal'}
              noOptionsMessage={() => {
                return <span>{gettext('No options')}</span>;
              }}
            />
          </Col>
        </Row>
      </div>
    );
  };

  renderMsg = () => {
    return (
      <div className="form-group settings-item">
        <Label className="item-label">{gettext('Content')}</Label>
        <Input
          type="textarea"
          name="text"
          style={{ minHeight: 100 }}
          value={this.state.default_msg}
          onChange={this.onMsgChanged}
          onBlur={this.onSaveAction}
        />
        <div className="seatable-tip-default mt-1">
          {gettext('Use {column name} to cite the content of a column')}
        </div>
      </div>
    );
  };

  render() {
    return (
      <>
        {this.renderUserSelect()}
        {this.renderMsg()}
      </>
    );
  }
}

SendNotice.propTypes = {
  action: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  columns: PropTypes.array,
  workflowRelatedUsers: PropTypes.array,
  onUpdateAction: PropTypes.func.isRequired,
};

export default SendNotice;
