import React from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext, orgID } from '../../utils/constants';
import { orgAdminServiceApi } from '../../api/org-admin-service-api.js';
import { Utils } from '../../utils/utils';
import UserSelect from '../user-select.js';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  toggle: PropTypes.func.isRequired,
  groupID: PropTypes.string.isRequired,
  onMemberChanged: PropTypes.func.isRequired
};

class AddMemberDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      selectedOption: null,
      errMessage: '',
    };
    this.Options = [];
  }

  handleSelectChange = (option) => {
    this.setState({ selectedOption: option });
    this.Options = [];
  };

  handleSubmit = () => {
    if (!this.state.selectedOption) return;
    const email = this.state.selectedOption.email;
    this.refs.orgSelect.clearSelect();
    this.setState({ errMessage: [] });
    orgAdminServiceApi.orgAdminAddGroupMember(orgID, this.props.groupID, email).then((res) => {
      this.setState({ selectedOption: null });
      if (res.data.failed.length > 0) {
        this.setState({ errMessage: res.data.failed[0].error_msg });
      }
      if (res.data.success.length > 0) {
        this.props.onMemberChanged();
        this.props.toggle();
      }
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    return (
      <Modal isOpen={true} toggle={this.props.toggle}>
        <DTableModalHeader toggle={this.props.toggle}>{gettext('Add member')}</DTableModalHeader>
        <ModalBody>
          <UserSelect
            placeholder={gettext('Search users')}
            onSelectChange={this.handleSelectChange}
            ref="orgSelect"
            isMulti={false}
            className='org-add-member-select'
          />
          { this.state.errMessage && <p className="error">{this.state.errMessage}</p> }
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.props.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.handleSubmit}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

AddMemberDialog.propTypes = propTypes;

export default AddMemberDialog;
