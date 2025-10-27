import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { gettext, siteRoot } from '@/constants';

class Member extends Component {

  constructor(props) {
    super(props);
  }

  getRoleText() {
    switch (this.props.data.role) {
      case 'Owner':
        return gettext('Owner');
      case 'Admin':
        return gettext('Admin');
      case 'Member':
        return gettext('Member');
      default:
        return null;
    }
  }

  render() {
    const item = this.props.data;
    return (
      <tr>
        <td className="text-center"><img src={item.avatar_url} alt="" className="avatar" width="32" /></td>
        <td><Link to={`${siteRoot}org/users/info/${encodeURIComponent(item.email)}/`}>{item.name}</Link></td>
        <td>{this.getRoleText()}</td>
        <td></td>
      </tr>
    );
  }
}

Member.propTypes = {
  data: PropTypes.object.isRequired
};

export default Member;

