import React from 'react';
import { Modal, ModalBody } from 'reactstrap';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { toaster, DTableModalHeader } from 'dtable-ui-component';
import Loading from '../../../components/loading';
import { seaQAAPI } from '../../../api/web-api';
import User from '../model/user';
import { gettext } from '../../../constants/config';
import { Utils } from '../../../utils/utils';

import '../../../css/dtable-workspace-member-dialog.css';

export default class DTableWorkspaceMemberDialog extends React.Component {

  static propTypes = {
    workspace: PropTypes.object,
    onGroupMemberToggle: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      groupMembers: [],
      isLoading: true,
    };
  }

  componentDidMount() {
    let { workspace } = this.props;
    let { group_id } = workspace;
    seaQAAPI.listGroupMembers(group_id).then((res) => {
      let groupMembers = res.data.map(item => {
        return new User(item);
      });
      this.setState({
        groupMembers,
        isLoading: false,
      });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  }

  getMembers = () => {
    const { groupMembers } = this.state;
    return groupMembers.map((member, index) => {
      let { avatar_url, name } = member;
      return (
        <div key={index} className="member-details">
          <img src={avatar_url} alt={name} className="member-avatar" />
          <span className="member-name">{name}</span>
        </div>
      );
    });
  };

  toggle = () => {
    this.props.onGroupMemberToggle();
  };

  render() {
    const { groupMembers, isLoading } = this.state;
    if (isLoading) {
      return (
        <Modal isOpen={true} toggle={this.toggle} className="dtable-group-member-content">
          <DTableModalHeader toggle={this.toggle}>{gettext('Group members')}</DTableModalHeader>
          <ModalBody className='group-members'>
            <div className="my-4">
              <Loading />
            </div>
          </ModalBody>
        </Modal>
      );
    }
    return (
      <Modal isOpen={true} toggle={this.toggle} className="dtable-group-member-content">
        <DTableModalHeader toggle={this.toggle}>{gettext('Group members') + ` (${groupMembers.length})`}</DTableModalHeader>
        <ModalBody className={classnames('group-members', { 'group-members-not-overflow': groupMembers.length < 7 })}>
          {this.getMembers()}
        </ModalBody>
      </Modal>
    );
  }
}
