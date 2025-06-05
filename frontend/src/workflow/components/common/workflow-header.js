import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import ShareWorkflowDialog from '../dialog/share-workflow-dialog';
import context from '../../utils/context';
import { WORKFLOW_ICONS, WORKFLOW_COLORS } from '../../constants';
import Icon from '../../../components/icon';

import '../../css/workflow-header.css';

const gettext = window.gettext;

const propTypes = {
  isSaving: PropTypes.bool.isRequired,
  workflowConfig: PropTypes.object.isRequired,
  updateWorkflowConfig: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  hasUnsavedChanges: PropTypes.bool
};

class WorkflowHeader extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowSharedDialog: false
    };
  }

  onShareDialogToggle = () => {
    this.setState({ isShowSharedDialog: !this.state.isShowSharedDialog });
  };

  onOpenShareApp = () => {
    const url = this.getAppShareLink();
    window.open(url);
  };

  getAppShareLink = () => {
    let slicedTableWebURL = context.getSetting('dtableWebURL');
    if (slicedTableWebURL.charAt(slicedTableWebURL.length - 1) === '/') {
      slicedTableWebURL = slicedTableWebURL.slice(0, slicedTableWebURL.length - 1);
    }
    const appToken = context.getSetting('appToken');
    return `${slicedTableWebURL}/dtable/workflows/${appToken}/form/`;
  };

  onSave = () => {
    if (!this.props.hasUnsavedChanges) {
      return;
    }
    return this.props.onSave();
  };

  render() {
    const { workflowConfig, isSaving, hasUnsavedChanges } = this.props;
    const { workflow_name, icon = WORKFLOW_ICONS[0], color = WORKFLOW_COLORS[0] } = workflowConfig;
    return (
      <Fragment>
        <div className="workflow-app-header">
          <div className="logo">
            <div className="workflow-app-icon-content mr-2 d-flex align-items-center justify-content-center" style={{ backgroundColor: color }}>
              <i className={`dtable-icon-color-white base-font ${icon}`}></i>
            </div>
            <div className="flex-1 mr-2 text-truncate" title={workflow_name}>{workflow_name}</div>
            {isSaving && <span className="tip-message">{gettext('Saving')}</span>}
          </div>
          <div className="option-items flex-shrink-0">
            <Button color="outline-primary" className="option-item" disabled={!hasUnsavedChanges} onClick={this.onSave}>
              <span>{gettext('Save')}</span>
            </Button>
            <Button color="outline-primary" className="option-item" onClick={this.onShareDialogToggle}>
              <Icon symbol="access-permissions" className="mr-2" />
              <span>{gettext('Manage permissions')}</span>
            </Button>
            {/* <button className="btn btn-outline-primary option-item" onClick={this.onOpenShareApp}>
              <i className="dtable-font dtable-icon-table mr-2"></i>
              <span>{gettext('App page')}</span>
            </button> */}
          </div>
        </div>
        {this.state.isShowSharedDialog && (
          <ShareWorkflowDialog
            workflowName={workflowConfig.workflow_name}
            appToken={context.getSetting('appToken')}
            dtableGroupId={context.getSetting('dtableGroupId')}
            shareCancel={this.onShareDialogToggle}
          />
        )}
      </Fragment>
    );
  }
}

WorkflowHeader.propTypes = propTypes;

export default WorkflowHeader;
