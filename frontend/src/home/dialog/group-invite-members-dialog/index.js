import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, Label, Input, InputGroup, UncontrolledTooltip } from 'reactstrap';
import copy from 'copy-to-clipboard';
import { toaster, ModalHeader, Icon } from '@/components';
import { gettext } from '@/constants/config';
import homeAPI from '../../api';
import { Utils } from '@/utils/utils';

import './index.css';

const propTypes = {
  workspace: PropTypes.object.isRequired,
  toggleGroupInviteDialog: PropTypes.func.isRequired,
};

class GroupInviteMembersDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      inviteList: [],
    };
  }

  componentDidMount() {
    this.listInviteLinks();
  }

  listInviteLinks = () => {
    homeAPI.getGroupInviteLinks(this.props.workspace.group_id).then((res) => {
      this.setState({ inviteList: res.data.group_invite_link_list });
    }).catch(error => {
      this.onError(error);
    });
  };

  addInviteLink = () => {
    homeAPI.addGroupInviteLinks(this.props.workspace.group_id).then(() => {
      this.listInviteLinks();
    }).catch(error => {
      this.onError(error);
    });
  };

  deleteLink = (token) => {
    homeAPI.deleteGroupInviteLinks(this.props.workspace.group_id, token).then(() => {
      this.listInviteLinks();
    }).catch(error => {
      this.onError(error);
    });
  };

  onError = (error) => {
    let errMsg = Utils.getErrorMsg(error, true);
    if (!error.response || error.response.status !== 403) {
      toaster.danger(errMsg);
    }
  };

  copyLink = () => {
    const inviteLinkItem = this.state.inviteList[0];
    copy(inviteLinkItem.link);
    const message = gettext('Invitation link has been copied to clipboard');
    toaster.success((message), {
      duration: 2
    });
  };

  toggle = () => {
    this.props.toggleGroupInviteDialog();
  };

  render() {
    const { inviteList } = this.state;
    const linkItem = inviteList[0];
    return (
      <Modal isOpen={true} toggle={this.toggle} className="group-invite-members">
        <ModalHeader toggle={this.toggle}>{gettext('Invite members')}</ModalHeader>
        <ModalBody>
          {linkItem ?
            <>
              <Label for="invite-link">{gettext('Group invitation link')}</Label>
              <InputGroup>
                <Input
                  value={linkItem.link}
                  disabled
                  className="text-truncate"
                  id="invite-link"
                />
                <Button color="secondary" onClick={this.copyLink} id="copy-link-button">
                  <Icon symbol="copy" />
                </Button>
                <UncontrolledTooltip placement="bottom" target="copy-link-button">
                  {gettext('Copy link')}
                </UncontrolledTooltip>
                <Button color="secondary" onClick={this.deleteLink.bind(this, linkItem.token)} className="delete-link-btn" id="delete-link-button">
                  <Icon symbol="delete" />
                </Button>
                <UncontrolledTooltip placement="bottom" target="delete-link-button">
                  {gettext('Delete link')}
                </UncontrolledTooltip>
              </InputGroup>
              <div className="no-link-tip my-4">
                {gettext('Users in your team can join the group via group invitation link. If the user has not registered yet, you should ask your team admin to add the user first.')}
              </div>
            </>
            :
            <>
              <div className="no-link-tip mb-4">
                {gettext('No group invitation link yet. Group invitation link let registered users to join the group by clicking a link.')}
              </div>
              <Button color="primary" onClick={this.addInviteLink} className="my-4">{gettext('Generate')}</Button>
            </>
          }
        </ModalBody>
      </Modal>
    );
  }
}

GroupInviteMembersDialog.propTypes = propTypes;

export default GroupInviteMembersDialog;
