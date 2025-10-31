import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter, Label } from 'reactstrap';
import { ModalHeader } from '@/components';
import { gettext } from '@/constants';
import homeAPI from '../api';
import UserSelect from '@/components/user-select';
import { Utils } from '@/utils/utils';

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
          <Button color="secondary" onClick={this.toggle}>{gettext('Close')}</Button>
          <Button color="primary" onClick={this.transferGroup} disabled={selectedUsers.length < 1}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

TransferGroupDialog.propTypes = propTypes;

export default TransferGroupDialog;
