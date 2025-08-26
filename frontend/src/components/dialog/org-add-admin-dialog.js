import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter, Alert } from 'reactstrap';
import { gettext, orgID } from '../../constants';
import { Utils } from '../../utils/utils';
import UserSelect from '../user-select';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import OrgUserInfo from '../../models/org-user';
import toaster from '../toaster';
import ModalHeader from '../modal-header';

const propTypes = {
  toggle: PropTypes.func.isRequired,
  onAddedOrgAdmin: PropTypes.func.isRequired,
};

class AddOrgAdminDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedOptions: [],
    };
  }

  handleSelectChange = (option) => {
    this.setState({
      selectedOptions: option,
    });
  };

  addOrgAdmin = () => {
    if (this.state.selectedOptions.length === 0) return;
    orgAdminServiceApi.orgAdminSetOrgAdmin(orgID, this.state.selectedOptions[0].email, true).then(res => {
      this.props.onAddedOrgAdmin(new OrgUserInfo(res.data));
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  toggle = () => {
    this.props.toggle();
  };

  render() {
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <ModalHeader toggle={this.toggle}>{gettext('Add admin')}</ModalHeader>
        <ModalBody>
          <UserSelect
            isMulti={false}
            className="reviewer-select"
            placeholder={gettext('Select a user as admin')}
            onSelectChange={this.handleSelectChange}
            selectedUsers={this.state.selectedOptions}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.addOrgAdmin}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

AddOrgAdminDialog.propTypes = propTypes;

export default AddOrgAdminDialog;
