import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Orgs from './orgs';

const propTypes = {
  onCloseSidePanel: PropTypes.func
};

class OrgBigDataStorage extends Component {

  constructor(props) {
    super(props);
  }

  render() {
    return <Orgs isBigDataStorage={true} onCloseSidePanel={this.props.onCloseSidePanel} />;
  }
}

OrgBigDataStorage.propTypes = propTypes;

export default OrgBigDataStorage;
