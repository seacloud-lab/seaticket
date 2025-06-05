import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { DTableEmptyTip } from 'dtable-ui-component';
import DepartmentGroupMember from './department-group-member';
import Loading from '../../../../../components/loading';

const gettext = window.gettext;
const { mediaUrl } = window.app.config;

class DepartmentGroupMembers extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoadingMore: false
    };
  }

  selectAll = () => {
    const { members } = this.props;
    this.props.selectAll(members);
  };

  handleScroll = (event) => {
    if (!this.state.isLoadingMore && this.props.hasMore) {
      const clientHeight = event.target.clientHeight;
      const scrollHeight = event.target.scrollHeight;
      const scrollTop = event.target.scrollTop;
      const isBottom = (clientHeight + scrollTop + 1 >= scrollHeight);
      if (isBottom) {
        this.setState({ isLoadingMore: true }, () => {
          this.props.getMoreOrgMembers().then(() => {
            this.setState({ isLoadingMore: false });
          });
        });
      }
    }
  };

  getEnableSelectAll = () => {
    const { memberSelected, selectedMemberMap, members } = this.props;
    if (!memberSelected || !Array.isArray(members)) {
      return false;
    }
    const selectedMap = Object.assign({}, memberSelected, selectedMemberMap);
    for (let i = 0; i < members.length; i++) {
      const email = members[i].email;
      if (!selectedMap[email]) {
        return true;
      }
    }
    return false;
  };

  render() {
    const { members, memberSelected, loading, selectedMemberMap, currentDepartment } = this.props;
    let headerTitle;
    if (currentDepartment.id === -1) {
      headerTitle = gettext('All users');
    } else {
      headerTitle = currentDepartment.name + ' ' + gettext('members');
    }
    const { isLoadingMore } = this.state;
    if (loading) {
      return (
        <div className="department-dialog-member pt-4">
          <div className="w-100">
            <div className='department-dialog-member-head px-4 mt-4'>
              <Loading />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="department-dialog-member pt-4">
        <div className="w-100" onScroll={this.handleScroll}>
          <div className='department-dialog-member-head px-4'>
            <div className='department-name'>
              {headerTitle}
            </div>
            {this.getEnableSelectAll() ?
              <div className='select-all' onClick={this.selectAll}>{gettext('Select All')}</div>
              :
              <div className='select-all-disable'>{gettext('Select All')}</div>
            }
          </div>
          {members.length > 0 ?
            <Fragment>
              <table className="department-dialog-member-table">
                <tbody>
                  {members.map((member, index) => {
                    return (
                      <DepartmentGroupMember
                        key={member.email}
                        isMemberSelected={selectedMemberMap[member.email]}
                        index={index}
                        member={member}
                        memberSelected={memberSelected}
                        onMemberSelectedChange={this.props.onMemberSelectedChange}
                      />
                    );
                  })}
                </tbody>
              </table>
              {isLoadingMore ? <Loading /> : ''}
            </Fragment>
            :
            <DTableEmptyTip src={`${mediaUrl}img/no-users-tip.png`} text={gettext('No members')} />
          }
        </div>
      </div>
    );
  }
}

DepartmentGroupMembers.propTypes = {
  loading: PropTypes.bool,
  hasMore: PropTypes.bool,
  members: PropTypes.array.isRequired,
  memberSelected: PropTypes.object.isRequired,
  currentDepartment: PropTypes.object.isRequired,
  selectedMemberMap: PropTypes.object,
  selectAll: PropTypes.func.isRequired,
  getMoreOrgMembers: PropTypes.func,
  onMemberSelectedChange: PropTypes.func.isRequired,
};

export default DepartmentGroupMembers;
