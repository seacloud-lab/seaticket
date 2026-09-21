import React from 'react';
import { Button, Modal, ModalBody, ModalFooter, Label } from 'reactstrap';
import PropTypes from 'prop-types';
import { ModalHeader } from '@/components';
import UserSelect from '@/components/user-select';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import homeAPI from '../api';

const propTypes = {
  groupID: PropTypes.number.isRequired,
  toggleTransferGroupDialog: PropTypes.func.isRequired,
  loadWorkspaceList: PropTypes.func.isRequired,
};

class TransferGroupDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      selectedUsers: [],
      errMessage: '',
    };
  }

  handleSelectChange = (selectedUsers) => {
    this.setState({ selectedUsers, errMessage: '' });
  };

  transferGroup = () => {
    const [user] = this.state.selectedUsers;
    const email = user?.email;
    if (email) {
      homeAPI.transferGroup(this.props.groupID, email).then((res) => {
        this.props.toggleTransferGroupDialog();
        this.props.loadWorkspaceList();
      }).catch((error) => {
        let errMessage = Utils.getErrorMsg(error);
        this.setState({ errMessage: errMessage });
      });
    }
  };

  toggle = () => {
    this.props.toggleTransferGroupDialog();
  };

  render() {
    const { selectedUsers } = this.state;
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <ModalHeader toggle={this.toggle}>{gettext('Transfer group')}</ModalHeader>
        <ModalBody>
          <Label for="transferGroupTo">{gettext('Transfer group to')}</Label>
          <UserSelect
            isMulti={false}
            className="reviewer-select"
            id="transferGroupTo"
            selectedUsers={selectedUsers}
            placeholder={gettext('Search users')}
            onSelectChange={this.handleSelectChange}
          />
          <div className="error">{this.state.errMessage}</div>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.transferGroup} disabled={selectedUsers.length < 1}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

TransferGroupDialog.propTypes = propTypes;

export default TransferGroupDialog;
