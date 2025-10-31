import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { ModalHeader } from '../../../components';
import { gettext } from '../../../constants/config';
import ListAndAddGroupMembers from '../list-and-add-group-members';

import './index.css';

const propTypes = {
  groupID: PropTypes.number.isRequired,
  isOwner: PropTypes.bool.isRequired,
  isAdmin: PropTypes.bool.isRequired,
  loadWorkspaceList: PropTypes.func.isRequired,
  toggleManageMembersDialog: PropTypes.func.isRequired,
};

class ManageMembersDialog extends React.Component {

  toggle = () => {
    this.props.toggleManageMembersDialog();
  };

  render() {
    const { groupID, isOwner, toggleManageMembersDialog, isAdmin, loadWorkspaceList } = this.props;
    return (
      <Modal isOpen={true} toggle={this.toggle} className="group-manage-members-dialog">
        <ModalHeader toggle={this.toggle}>
          {gettext('Manage group members')}
        </ModalHeader>
        <ModalBody className="pb-0">
          <ListAndAddGroupMembers
            groupID={groupID}
            isOwner={isOwner}
            changeMode={this.changeMode}
            toggleManageMembersDialog={toggleManageMembersDialog}
            isAdmin={isAdmin}
            loadWorkspaceList={loadWorkspaceList}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Close')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

ManageMembersDialog.propTypes = propTypes;

export default ManageMembersDialog;
