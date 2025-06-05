import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import MainPanelTopbar from './main-panel-topbar';
import Subscription from '../../components/subscription';

const propTypes = {
  onCloseSidePanel: PropTypes.func,
};

class OrgSubscription extends Component {
  render() {
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading">{'付费管理'}</h2>
            <div className="pt-2 h-100 o-auto">
              <Subscription isOrgContext={true} />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

OrgSubscription.propTypes = propTypes;

export default OrgSubscription;
