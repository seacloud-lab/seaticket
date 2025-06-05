import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../../utils/constants';
import DeleteDepartMemberDialog from '../../../../components/dialog/sysadmin-dialog/sysadmin-delete-depart-member-dialog';
import MemberItem from './member-item';
import Loading from '../../../../components/loading';

const propTypes = {
  groupID: PropTypes.string,
  members: PropTypes.array,
  onMemberChanged: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

class Members extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
      deletedMember: null,
      isShowDeleteMemberDialog: false,
    };
  }

  toggleItemFreezed = () => {
    this.setState({ isItemFreezed: !this.state.isItemFreezed });
  };

  showDeleteMemberDialog = (member) => {
    this.setState({ isShowDeleteMemberDialog: true, deletedMember: member });
  };

  onMemberChanged = () => {
    this.props.onMemberChanged();
  };

  toggleCancel = () => {
    this.setState({ isShowDeleteMemberDialog: false });
  };

  renderDialogOperations = () => {
    const { groupID } = this.props;
    const { isShowDeleteMemberDialog, deletedMember } = this.state;
    return (
      <Fragment>
        {isShowDeleteMemberDialog && (
          <DeleteDepartMemberDialog
            groupID={groupID}
            member={deletedMember}
            onMemberChanged={this.onMemberChanged}
            toggle={this.toggleCancel}
          />
        )}
      </Fragment>
    );
  };

  render() {
    const { groupID, isLoading, members } = this.props;
    return (
      <Fragment>
        <div className="cur-view-subcontainer org-members">
          <div className="cur-view-content">
            {isLoading && <Loading />}
            {!isLoading && members.length === 0 && (
              <p className="no-member">{gettext('No members')}</p>
            )}
            {(!isLoading && members.length > 0) && (
              <table>
                <thead>
                  <tr>
                    <th width="5%"></th>
                    <th width="50%">{gettext('Name')}</th>
                    <th width="15%" className="pl-0">{gettext('Role')}</th>
                    <th width="30%"></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member, index) => {
                    return (
                      <MemberItem
                        key={index}
                        groupID={groupID}
                        member={member}
                        isItemFreezed={this.state.isItemFreezed}
                        toggleItemFreezed={this.toggleItemFreezed}
                        showDeleteMemberDialog={this.showDeleteMemberDialog}
                        onMemberChanged={this.onMemberChanged}
                      />
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
        {this.renderDialogOperations()}
      </Fragment>
    );
  }
}

Members.propTypes = propTypes;

export default Members;
