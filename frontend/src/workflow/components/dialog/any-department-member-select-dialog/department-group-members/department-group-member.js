import React from 'react';
import PropTypes from 'prop-types';
import { UncontrolledTooltip } from 'reactstrap';

const gettext = window.gettext;

class DepartmentGroupMember extends React.Component {

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

  onChange = (e) => {
    const { member } = this.props;
    this.props.onMemberSelectedChange(member);
  };

  render() {
    const { member, memberSelected, isMemberSelected, index } = this.props;

    if (isMemberSelected) {
      return (
        <tr
          className={this.state.highlight ? 'tr-highlight group-item' : 'group-item'}
          onMouseEnter={this.handleMouseEnter}
          onMouseLeave={this.handleMouseLeave}
        >
          <td width="13%">
            <input type="checkbox" className="vam" checked='checked' disabled/>
          </td>
          <td width="11%"><img className="avatar" src={member.avatar_url} alt=""/></td>
          <td width="60%">{member.name}</td>
          <td width="16%" className={this.state.highlight ? 'visible' : 'invisible' }>
            <i className="dtable-font dtable-icon-use-help" id={`no-select-${index}`}></i>
            <UncontrolledTooltip
              placement='bottom'
              target={`no-select-${index}`}
            >
              {gettext('User is already selected.')}
            </UncontrolledTooltip>
          </td>
        </tr>
      );
    }
    return (
      <tr
        className={this.state.highlight ? 'tr-highlight group-item' : 'group-item'}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
      >
        <td width="13%">
          <input
            type="checkbox"
            className="vam"
            onChange={this.onChange}
            checked={(member.email in memberSelected) ? 'checked' : ''}
          />
        </td>
        <td width="11%">
          <img className="avatar" src={member.avatar_url} alt=""/>
        </td>
        <td width="76%">{member.name}</td>
      </tr>
    );
  }
}

DepartmentGroupMember.propTypes = {
  isMemberSelected: PropTypes.bool,
  index: PropTypes.number,
  member: PropTypes.object,
  memberSelected: PropTypes.object,
  onMemberSelectedChange: PropTypes.func.isRequired,
};

export default DepartmentGroupMember;
