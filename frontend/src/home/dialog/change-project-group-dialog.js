import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter, Label } from 'reactstrap';
import { ModalHeader, toaster } from '@/components';
import CustomizeSelect from '@/components/customize-select';
import { Utils } from '@/utils/utils';
import homeAPI from '../api';

const gettext = window.gettext;

const propTypes = {
  currentProject: PropTypes.object.isRequired,
  currentWorkspace: PropTypes.object.isRequired,
  toggleDialog: PropTypes.func.isRequired,
  loadWorkspaceList: PropTypes.func.isRequired,
};

class ChangeProjectGroupDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      groups: [],
      selectedGroupID: '',
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
        groups: workspaces,
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

  onGroupChange = (groupID) => {
    this.setState({
      selectedGroupID: groupID || '',
      errMessage: '',
    });
  };

  onSubmit = () => {
    const { selectedGroupID } = this.state;
    const { currentProject, currentWorkspace } = this.props;
    const workspaceTargetID = String(currentWorkspace.id);
    if (!selectedGroupID) {
      this.setState({ errMessage: gettext('Please select a group.') });
      return;
    }
    if (selectedGroupID === workspaceTargetID) {
      this.setState({ errMessage: gettext('Project is already in this group.') });
      return;
    }

    this.setState({ isSubmitting: true, errMessage: '' });
    homeAPI.updateProject(currentWorkspace.id, currentProject.name, { workspace_id: selectedGroupID }).then(() => {
      toaster.success(gettext('Project moved'));
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
    const { groups, selectedGroupID, errMessage, isLoading, isSubmitting } = this.state;
    const workspaceTargetID = String(currentWorkspace.id);
    const disabled = isLoading || !selectedGroupID || selectedGroupID === workspaceTargetID || isSubmitting;
    const selectedGroup = groups.find(group => group.value === selectedGroupID) || null;

    return (
      <Modal isOpen={true} toggle={toggleDialog}>
        <ModalHeader toggle={toggleDialog}>{gettext('Change project group')}</ModalHeader>
        <ModalBody>
          <Label for="project-group-selector">{gettext('Move project {placeholder} to').replace('{placeholder}', `"${currentProject.name}"`)}</Label>
          <CustomizeSelect
            id="project-group-selector"
            value={selectedGroup}
            options={groups}
            onChange={this.onGroupChange}
            placeholder={gettext('Select a group')}
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

ChangeProjectGroupDialog.propTypes = propTypes;

export default ChangeProjectGroupDialog;
