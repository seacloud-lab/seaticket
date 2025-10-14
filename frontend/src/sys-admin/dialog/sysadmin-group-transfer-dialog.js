import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { Utils } from '../../utils/utils';
import { gettext } from '../../constants';
import ModalHeader from '../../components/modal-header';
import UserSelect from '../../components/user-select';
import sysAdminAPI from '../api';

const propTypes = {
  transferGroup: PropTypes.func.isRequired,
  toggleDialog: PropTypes.func.isRequired,
  item: PropTypes.object.isRequired,
};

class SysAdminTransferGroupDialog extends React.Component {

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
    if (!receiver) return;
    this.props.transferGroup(receiver);
    this.props.toggleDialog();
  };

  render() {
    const { selectedUsers } = this.state;
    let { item } = this.props;
    let orgID = item.org_id ? item.org_id : -1;
    let groupName = Utils.HTMLescape(item.name);

    const innerSpan = '<span class="op-target" title=' + groupName + '>' + groupName + '</span>';
    const msg = gettext('Transfer group {name} to').replace('{name}', innerSpan);
    return (
      <Modal isOpen={true} toggle={this.props.toggleDialog}>
        <ModalHeader toggle={this.props.toggleDialog}>
          <span dangerouslySetInnerHTML={{ __html: msg }}></span>
        </ModalHeader>
        <ModalBody>
          <UserSelect
            api={(value) => sysAdminAPI.sysAdminSearchUserByOrgID(value, orgID)}
            isMulti={false}
            selectedUsers={selectedUsers}
            className="reviewer-select"
            placeholder={gettext('Select a user')}
            onSelectChange={this.handleSelectChange}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.props.toggleDialog}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.submit} disabled={selectedUsers.length < 1}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

SysAdminTransferGroupDialog.propTypes = propTypes;

export default SysAdminTransferGroupDialog;
