import React from 'react';
import { Button, Modal, ModalBody, ModalFooter, Label } from 'reactstrap';
import PropTypes from 'prop-types';
import { ModalHeader, toaster, CustomizeSelect } from '@/components';
import { Utils } from '@/utils/utils';
import homeAPI from '../api';

const gettext = window.gettext;

const propTypes = {
  currentProject: PropTypes.object.isRequired,
  currentWorkspace: PropTypes.object.isRequired,
  toggleDialog: PropTypes.func.isRequired,
  loadWorkspaceList: PropTypes.func.isRequired,
};

class TransferProjectDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      workspaces: [],
      selectedWorkspaceID: '',
      errMessage: '',
      isLoading: true,
      isSubmitting: false,
    };
  }

  componentDidMount() {
    this.loadTargetWorkspaces();
  }

  loadTargetWorkspaces = () => {
    const currentWorkspaceID = String(this.props.currentWorkspace.id);
    homeAPI.listWorkspaces(false).then((res) => {
      const workspaces = (res.data.workspace_list || [])
        .filter(workspace => workspace.type === 'personal' || workspace.is_admin)
        .filter(workspace => String(workspace.id) !== currentWorkspaceID)
        .map(workspace => ({
          value: String(workspace.id),
          label: workspace.name,
        }));
      this.setState({
        workspaces,
        isLoading: false,
      });
    }).catch((error) => {
      const errMessage = Utils.getErrorMsg(error);
      this.setState({
        errMessage,
        isLoading: false,
      });
    });
  };

  onWorkspaceChange = (workspaceID) => {
    this.setState({
      selectedWorkspaceID: workspaceID || '',
      errMessage: '',
    });
  };

  onSubmit = () => {
    const { selectedWorkspaceID } = this.state;
    const { currentProject, currentWorkspace } = this.props;
    const targetWorkspaceID = String(currentWorkspace.id);
    if (!selectedWorkspaceID) {
      this.setState({ errMessage: gettext('Please select a group.') });
      return;
    }
    if (selectedWorkspaceID === targetWorkspaceID) {
      this.setState({ errMessage: gettext('Project is already in this group.') });
      return;
    }

    this.setState({ isSubmitting: true, errMessage: '' });
    homeAPI.updateProject(currentWorkspace.id, currentProject.name, { workspace_id: selectedWorkspaceID }).then(() => {
      toaster.success(gettext('Project transferred'));
      this.props.toggleDialog();
      this.props.loadWorkspaceList();
    }).catch((error) => {
      const errMessage = Utils.getErrorMsg(error);
      this.setState({
        errMessage,
        isSubmitting: false,
      });
    });
  };

  render() {
    const { currentProject, currentWorkspace, toggleDialog } = this.props;
    const { workspaces, selectedWorkspaceID, errMessage, isLoading, isSubmitting } = this.state;
    const targetWorkspaceID = String(currentWorkspace.id);
    const disabled = isLoading || !selectedWorkspaceID || selectedWorkspaceID === targetWorkspaceID || isSubmitting;

    return (
      <Modal isOpen={true} toggle={toggleDialog}>
        <ModalHeader toggle={toggleDialog}>{gettext('Transfer project')}</ModalHeader>
        <ModalBody>
          <Label for="project-group-selector">{gettext('Transfer project {placeholder} to').replace('{placeholder}', `"${currentProject.name}"`)}</Label>
          <CustomizeSelect
            id="project-group-selector"
            value={selectedWorkspaceID}
            options={workspaces}
            onChange={this.onWorkspaceChange}
            placeholder={gettext('Select a group')}
            noOptionsPlaceholder={gettext('No groups available')}
            disabled={isLoading || isSubmitting}
            isInModal={true}
          />
          {errMessage ? <div className="error mt-2">{errMessage}</div> : null}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={toggleDialog}>{gettext('Cancel')}</Button>
          <Button color="primary" disabled={disabled} onClick={this.onSubmit}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

TransferProjectDialog.propTypes = propTypes;

export default TransferProjectDialog;
