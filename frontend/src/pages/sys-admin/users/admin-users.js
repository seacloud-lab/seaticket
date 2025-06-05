import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Users from './users';

const propTypes = {
  onCloseSidePanel: PropTypes.func
};

class AdminUsers extends Component {

  render() {
    return <Users isAdmin={true} onCloseSidePanel={this.props.onCloseSidePanel} />;
  }
}

AdminUsers.propTypes = propTypes;

export default AdminUsers;
