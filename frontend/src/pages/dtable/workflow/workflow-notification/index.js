import React, { Component } from 'react';
import IconButton from 'dtable-ui-component/lib/IconButton';
import { gettext } from '../../../../utils/constants';

import './index.css';

export default class WorkflowNotification extends Component {

  state = {
    showNotice: true,
  };

  closeNotice = () => {
    window.localStorage.setItem('hide-workflow-notification', true);
    this.setState({ showNotice: false });
  };

  render() {
    if (this.state.showNotice === false || window.localStorage.getItem('hide-workflow-notification') === 'true') {
      return null;
    }
    return (
      <div className="workflow-notification" id="workflow-notification">
        <span>{gettext('Workflows cannot currently be created on mobile. Please go to the PC web interface, enter a base, and click the workflow menu item to create a workflow.')}</span>
        <IconButton icon="x" onClick={this.closeNotice} />
      </div>
    );
  }
}
