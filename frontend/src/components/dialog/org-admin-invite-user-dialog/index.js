import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody } from 'reactstrap';
import copy from 'copy-to-clipboard';
import { QRCodeCanvas } from 'qrcode.react';
import { gettext } from '../../../constants';
import ModalHeader from '../../modal-header';
import toaster from '../../toaster';

import './index.css';

const propTypes = {
  toggle: PropTypes.func.isRequired,
  invitationLink: PropTypes.string.isRequired
};

class InviteUserDialog extends React.Component {

  constructor(props) {
    super(props);
  }

  copyLink = () => {
    copy(this.props.invitationLink);
    const message = gettext('Invitation link has been copied to clipboard');
    toaster.success((message), {
      duration: 2
    });
  };

  render() {
    return (
      <Modal isOpen={true} className="org-admin-invite-user-dialog">
        <ModalHeader toggle={this.props.toggle}>{gettext('Invite user')}</ModalHeader>
        <ModalBody className="org-admin-invite-user-container d-flex flex-row">
          <div className="org-admin-invite-user-item">
            <div className="org-admin-invite-user">
              <span className="org-admin-invite-user-text">{gettext('Send the invitation link or QR code to the others, and they will be able to join the organization via scanning the QR code.')}</span>
            </div>
            <div className="org-admin-invite-user-copy-link">
              <span className="org-admin-invite-user-link">{this.props.invitationLink}</span>
              <Button color="primary" onClick={this.copyLink} className="org-admin-invite-user-link-btn" title={gettext('Copy')}>{gettext('Copy')}</Button>
            </div>
          </div>
          <div className="org-admin-invite-qrcode text-center">
            <div className="org-admin-invite-qrcode-content">
              <QRCodeCanvas value={this.props.invitationLink} size={80} />
            </div>
            <div className="org-admin-invite-qrcode-tip">
              <span className="qrcode-tip-content">{gettext('Scan QR code')}</span>
              <span className="qrcode-tip-content">{gettext('Join the orgainization directly')}</span>
            </div>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

InviteUserDialog.propTypes = propTypes;

export default InviteUserDialog;
