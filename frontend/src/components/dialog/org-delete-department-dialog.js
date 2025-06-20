import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext, orgID } from '../../constants';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import { Utils } from '../../utils/utils';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  groupName: PropTypes.string,
  groupID: PropTypes.string.isRequired,
  toggle: PropTypes.func.isRequired,
  onDepartChanged: PropTypes.func.isRequired
};

class DeleteDepartDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      errMessage: null
    };
  }

  deleteDepart = () => {
    orgAdminServiceApi.orgAdminDeleteDepartGroup(orgID, this.props.groupID).then((res) => {
      if (res.data.success) {
        this.props.onDepartChanged();
        this.props.toggle();
      }
    }).catch(err => {
      let errMessage = Utils.getErrorMsg(err);
      if (err.response && err.response.data && err.response.data['error_msg']) {
        errMessage = err.response.data['error_msg'];
      }
      this.setState({ errMessage: errMessage });
    });
  };

  render() {
    let subtitle = gettext('Are you sure you want to delete {placeholder} ?');
    subtitle = subtitle.replace('{placeholder}', '<span class="op-target">' + Utils.HTMLescape(this.props.groupName) + '</span>');
    return (
      <Modal isOpen={true} toggle={this.props.toggle}>
        <DTableModalHeader toggle={this.props.toggle}>{gettext('Delete department')}</DTableModalHeader>
        <ModalBody>
          <div dangerouslySetInnerHTML={{ __html: subtitle }}></div>
          { this.state.errMessage && <p className="error">{this.state.errMessage}</p> }
        </ModalBody>
        <ModalFooter>
          {!this.state.errMessage && <Button color="primary" onClick={this.deleteDepart}>{gettext('Delete')}</Button>}
          <Button color="secondary" onClick={this.props.toggle}>{gettext('Cancel')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

DeleteDepartDialog.propTypes = propTypes;

export default DeleteDepartDialog;
