import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

class DepartmentsV2MemberItem extends React.Component {

  static propTypes = {
    member: PropTypes.object,
    selectedMember: PropTypes.object,
    canShowDTables: PropTypes.bool,
    onSelectMember: PropTypes.func
  };

  constructor(props) {
    super(props);
    this.state = {
      active: false
    };
  }

  onMouseEnter = () => {
    const { selectedMember, member } = this.props;
    if (selectedMember && selectedMember.email === member.email) {
      return;
    }
    this.setState({ active: true });
  };

  onMouseLeave = () => {
    this.setState({ active: false });
  };

  onMemberClick = () => {
    const { member, canShowDTables } = this.props;
    if (canShowDTables) {
      this.props.onSelectMember(member);
    }
  };

  render() {
    const { member, selectedMember, canShowDTables } = this.props;
    const { active } = this.state;
    const divClass = classNames({
      'tr-highlight': active,
      'member-item-selected': selectedMember && selectedMember.email === member.email,
      'cursor-pointer': canShowDTables,
      'departments-v2-member-item': true
    });
    return (
      <div
        className={divClass}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
        onClick={this.onMemberClick}
      >
        <span className="mr-4">
          <img className='avatar' alt='' src={member.avatar_url} />
        </span>
        <span className="flex-1 text-truncate">
          {member.name}
        </span>
      </div>
    );
  }
}

export default class DepartmentsV2MembersList extends React.Component {

  static propTypes = {
    membersList: PropTypes.array,
    selectedMember: PropTypes.object,
    canShowDTables: PropTypes.bool,
    onSelectMember: PropTypes.func
  };

  render() {
    const { membersList, selectedMember, canShowDTables } = this.props;
    return (
      <div className='departments-v2-members'>
        {membersList.map(member => {
          return (
            <DepartmentsV2MemberItem
              key={member.email}
              member={member}
              selectedMember={selectedMember}
              canShowDTables={canShowDTables}
              onSelectMember={this.props.onSelectMember}
            />
          );
        })}
      </div>
    );
  }
}
