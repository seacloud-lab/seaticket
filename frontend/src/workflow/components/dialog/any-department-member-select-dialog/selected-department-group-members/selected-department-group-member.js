import React from 'react';
import PropTypes from 'prop-types';

class SelectedDepartmentGroupMember extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      highlight: false,
    };
  }

  handleMouseEnter = () => {
    this.setState({ highlight: true });
  };

  handleMouseLeave = () => {
    this.setState({ highlight: false });
  };

  onRemoveMember = (email) => {
    this.props.onRemoveMember(email);
  };

  render() {
    const { member } = this.props;
    return (
      <tr
        className={this.state.highlight ? 'tr-highlight group-item' : 'group-item'}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
      >
        <td width="17%"><img className="avatar" src={member.avatar_url} alt=""/></td>
        <td width="78%">{member.name}</td>
        <td width="10%">
          <i
            className="dtable-font dtable-icon-cancel"
            name={member.email}
            onClick={this.onRemoveMember.bind(this, member.email)}>
          </i>
        </td>
      </tr>
    );
  }
}

SelectedDepartmentGroupMember.propTypes = {
  member: PropTypes.object,
  onRemoveMember: PropTypes.func
};

export default SelectedDepartmentGroupMember;
