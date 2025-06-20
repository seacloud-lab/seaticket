import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { Modal, ModalBody, ModalFooter, Button } from 'reactstrap';
import { gettext, siteRoot } from '../../utils/constants';
import { seaQAAPI } from '../../api/web-api';
import { Utils } from '../../utils/utils';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  toggle: PropTypes.func.isRequired
};

class ConfirmUserConvertToTeam extends Component {

  constructor(props) {
    super(props);
  }

  confirm = () => {
    seaQAAPI.userConvertToTeam().then((res) => {
      toaster.success(gettext('Converted to team account'));
      window.location.href = siteRoot + 'org/orgmanage/';
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    const { toggle } = this.props;
    return (
      <Modal centered={true} isOpen={true} toggle={toggle}>
        <DTableModalHeader toggle={toggle}>{gettext('Convert to team account')}</DTableModalHeader>
        <ModalBody>
          <p>{gettext('Do you really want to convert to team account?')}</p>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.confirm}>{gettext('Confirm')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

ConfirmUserConvertToTeam.propTypes = propTypes;

export default ConfirmUserConvertToTeam;
