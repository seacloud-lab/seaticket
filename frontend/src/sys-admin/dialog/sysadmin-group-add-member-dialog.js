import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext } from '../../constants';
import ModalHeader from '../../components/modal-header';
import UserSelect from '../../components/user-select';
import sysAdminAPI from '../api';

const propTypes = {
  toggle: PropTypes.func.isRequired,
  addMembers: PropTypes.func.isRequired,
  orgID: PropTypes.number.isRequired,
};

class SysAdminGroupAddMemberDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      selectedUsers: [],
    };
  }

  handleSelectChange = (selectedUsers) => {
    this.setState({ selectedUsers });
  };

  addMembers = () => {
    const emails = this.state.selectedUsers.map(item => item.email);
    this.props.addMembers(emails);
    this.props.toggle();
  };

  render() {
    const { selectedUsers } = this.state;
    const { orgID } = this.props;
    return (
      <Modal isOpen={true} toggle={this.props.toggle}>
        <ModalHeader toggle={this.props.toggle}>{gettext('Add member')}</ModalHeader>
        <ModalBody>
          <UserSelect
            api={(value) => sysAdminAPI.sysAdminSearchUserByOrgID(value, orgID)}
            isMulti={true}
            selectedUsers={selectedUsers}
            className="reviewer-select"
            placeholder={gettext('Select a user')}
            onSelectChange={this.handleSelectChange}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.props.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.addMembers} disabled={selectedUsers.length < 1}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

SysAdminGroupAddMemberDialog.propTypes = propTypes;

export default SysAdminGroupAddMemberDialog;
