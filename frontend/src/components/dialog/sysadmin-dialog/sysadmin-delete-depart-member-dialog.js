import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { gettext } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';
import { DTableModalHeader } from 'dtable-ui-component';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const propTypes = {
  member: PropTypes.object.isRequired,
  groupID: PropTypes.string.isRequired,
  toggle: PropTypes.func.isRequired,
  onMemberChanged: PropTypes.func.isRequired
};

class DeleteDepartMemberDialog extends React.Component {

  constructor(props) {
    super(props);
  }

  deleteMember = () => {
    const userEmail = this.props.member.email;
    sysAdminServiceApi.sysAdminDeleteGroupMember(this.props.groupID, userEmail).then((res) => {
      if (res.data.success) {
        this.props.onMemberChanged();
        this.props.toggle();
      }
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    let subtitle = gettext('Are you sure you want to delete {placeholder} ?');
    subtitle = subtitle.replace('{placeholder}', '<span class="op-target">' + Utils.HTMLescape(this.props.member.name) + '</span>');
    return (
      <Modal isOpen={true} toggle={this.props.toggle}>
        <DTableModalHeader toggle={this.props.toggle}>{gettext('Delete member')}</DTableModalHeader>
        <ModalBody>
          <div dangerouslySetInnerHTML={{ __html: subtitle }}></div>
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onClick={this.deleteMember}>{gettext('Delete')}</Button>
          <Button color="secondary" onClick={this.props.toggle}>{gettext('Cancel')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

DeleteDepartMemberDialog.propTypes = propTypes;

export default DeleteDepartMemberDialog;
