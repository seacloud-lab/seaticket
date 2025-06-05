import React from 'react';
import PropTypes from 'prop-types';
import { Label, FormGroup } from 'reactstrap';
import { gettext } from '../../../../utils/constants';
import ActionItem from './action-item';
import AddAction from './add-action';
import NodeActionSettingsDialog from '../../dialog/node-action-settings-dialog';
import { generatorActionByType } from '../../../utils/node-action-utils';

import '../../../css/app-settings/node-action.css';

class WorkflowNodeActionSettings extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowActionSettingsDialog: false,
      activeAction: null,
    };
    this.isAddAction = false;
  }

  onSelectAction = (event, action) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    this.isAddAction = false;
    this.setState({ isShowActionSettingsDialog: true, activeAction: action });
  };

  addAction = (actionType) => {
    const { selectedNode } = this.props;
    const { actions = [] } = selectedNode;
    const newAction = generatorActionByType(actions, actionType);
    this.isAddAction = true;
    this.setState({ isShowActionSettingsDialog: true, activeAction: newAction });
  };

  onUpdateAction = (action) => {
    if (this.isAddAction) {
      this.props.onAddAction(action);
      return;
    }
    this.props.onUpdateAction(action);
  };

  closeActionSettingsDialog = () => {
    this.setState({ isShowActionSettingsDialog: false, activeAction: null });
  };

  onDeleteAction = (event, action) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    this.props.onDeleteAction(action._id);
  };

  render() {
    const { selectedNode, workflowRelatedUsers, dtableUtils, workflowConfig } = this.props;
    const { isShowActionSettingsDialog, activeAction } = this.state;
    const { actions = [] } = selectedNode;

    return (
      <>
        <FormGroup key="form-column-settings" className="setting-item table-setting node-actions-settings">
          <Label>{gettext('After entering this node, perform the following actions')}</Label>
          {actions.map(action => {
            return (
              <ActionItem
                key={action._id}
                action={action}
                onSelectAction={(event) => this.onSelectAction(event, action)}
                onDeleteAction={(event) => this.onDeleteAction(event, action)}
              />
            );
          })}
          <AddAction addAction={this.addAction} />
        </FormGroup>
        {isShowActionSettingsDialog && (
          <NodeActionSettingsDialog
            action={activeAction}
            dtableUtils={dtableUtils}
            workflowRelatedUsers={workflowRelatedUsers}
            workflowConfig={workflowConfig}
            onToggle={this.closeActionSettingsDialog}
            onDeleteAction={this.onDeleteAction}
            onUpdateAction={this.onUpdateAction}
          />
        )}
      </>
    );
  }
}

WorkflowNodeActionSettings.propTypes = {
  selectedNode: PropTypes.object,
  dtableUtils: PropTypes.object,
  workflowConfig: PropTypes.object,
  workflowRelatedUsers: PropTypes.array,
  onAddAction: PropTypes.func.isRequired,
  onDeleteAction: PropTypes.func.isRequired,
  onUpdateAction: PropTypes.func.isRequired,
};

export default WorkflowNodeActionSettings;
