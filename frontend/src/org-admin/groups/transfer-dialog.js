import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { Utils } from '@/utils/utils';
import { gettext } from '@/constants';
import { ModalHeader, UserSelect } from '@/components';

class TransferDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      selectedUsers: [],
    };
  }

  handleSelectChange = (selectedUsers) => {
    this.setState({ selectedUsers });
  };

  submit = () => {
    const [user] = this.state.selectedUsers;
    const receiver = user?.email;
    this.props.transferGroup(receiver);
    this.props.toggleDialog();
  };

  render() {
    const { selectedUsers } = this.state;
    const groupName = Utils.HTMLescape(this.props.groupName);
    const innerSpan = '<span class="op-target" title=' + groupName + '>' + groupName + '</span>';
    const msg = gettext('Transfer group {name} to').replace('{name}', innerSpan);
    return (
      <Modal isOpen={true} toggle={this.props.toggleDialog}>
        <ModalHeader toggle={this.props.toggleDialog}>
          <span dangerouslySetInnerHTML={{ __html: msg }}></span>
        </ModalHeader>
        <ModalBody>
          <UserSelect
            isMulti={false}
            selectedUsers={selectedUsers}
            className="reviewer-select"
            placeholder={gettext('Select a user')}
            onSelectChange={this.handleSelectChange}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.props.toggleDialog}>{gettext('Cancel')}</Button>
          <Button color="primary" disabled={selectedUsers.length < 1} onClick={this.submit}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

TransferDialog.propTypes = {
  groupName: PropTypes.string.isRequired,
  transferGroup: PropTypes.func.isRequired,
  toggleDialog: PropTypes.func.isRequired
};

export default TransferDialog;
