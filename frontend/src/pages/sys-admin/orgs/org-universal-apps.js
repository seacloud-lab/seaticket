import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Orgs from './orgs';

const propTypes = {
  onCloseSidePanel: PropTypes.func
};

class OrgUniversalApps extends Component {

  constructor(props) {
    super(props);
  }

  render() {
    return <Orgs isUniversalApps={true} onCloseSidePanel={this.props.onCloseSidePanel} />;
  }
}

OrgUniversalApps.propTypes = propTypes;

export default OrgUniversalApps;
