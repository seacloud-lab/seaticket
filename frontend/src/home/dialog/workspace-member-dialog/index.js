import React from 'react';
import { Modal, ModalBody } from 'reactstrap';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { toaster, ModalHeader, CenteredLoading } from '@/components';
import homeAPI from '../../api';
import User from '@/models/user';
import { gettext } from '@/constants/config';
import { Utils } from '@/utils/utils';

import './index.css';

export default class WorkspaceMemberDialog extends React.Component {

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
    homeAPI.listGroupMembers(this.props.workspace.group_id).then((res) => {
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

  getRoleText = (role) => {
    switch (role) {
      case 'Owner':
        return gettext('Owner');
      case 'Admin':
        return gettext('Admin');
      case 'Member':
      default:
        return '';
    }
  };

  getMembers = () => {
    const { groupMembers } = this.state;
    return groupMembers.map((member, index) => {
      let { avatar_url, name, role } = member;
      const roleText = this.getRoleText(role);
      return (
        <div key={index} className="member-details">
          <img src={avatar_url} alt={name} className="member-avatar" />
          <span className="member-name">{name}</span>
          {roleText && <span className="member-role">{roleText}</span>}
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
        <Modal isOpen={true} toggle={this.toggle} className="seaqa-group-member-content">
          <ModalHeader toggle={this.toggle}>{gettext('Group members')}</ModalHeader>
          <ModalBody className='group-members'>
            <CenteredLoading style={{ minHeight: '200px' }} />
          </ModalBody>
        </Modal>
      );
    }
    return (
      <Modal isOpen={true} toggle={this.toggle} className="seaqa-group-member-content">
        <ModalHeader toggle={this.toggle}>{gettext('Group members') + ` (${groupMembers.length})`}</ModalHeader>
        <ModalBody className={classnames('group-members', { 'group-members-not-overflow': groupMembers.length < 7 })}>
          {this.getMembers()}
        </ModalBody>
      </Modal>
    );
  }
}
