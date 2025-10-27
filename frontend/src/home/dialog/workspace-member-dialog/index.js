import React from 'react';
import { Modal, ModalBody } from 'reactstrap';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { toaster, ModalHeader, Loading } from '@/components';
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
    let { workspace } = this.props;
    let { group_id } = workspace;
    homeAPI.listGroupMembers(group_id).then((res) => {
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
        <Modal isOpen={true} toggle={this.toggle} className="sea-qa-group-member-content">
          <ModalHeader toggle={this.toggle}>{gettext('Group members')}</ModalHeader>
          <ModalBody className='group-members'>
            <div className="my-4">
              <Loading />
            </div>
          </ModalBody>
        </Modal>
      );
    }
    return (
      <Modal isOpen={true} toggle={this.toggle} className="sea-qa-group-member-content">
        <ModalHeader toggle={this.toggle}>{gettext('Group members') + ` (${groupMembers.length})`}</ModalHeader>
        <ModalBody className={classnames('group-members', { 'group-members-not-overflow': groupMembers.length < 7 })}>
          {this.getMembers()}
        </ModalBody>
      </Modal>
    );
  }
}
