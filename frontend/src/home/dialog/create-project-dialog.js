import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { ModalHeader, toaster } from '@/components';
import homeAPI from '../api';
import Project from '../models/project';
import { Utils } from '@/utils/utils';
import { validateName } from '@/utils/validate';
import ProjectSettingContent from '../components/project-setting-content';
import SelectProjectIconDialog from './select-project-icon-dialog';
import { DEFAULT_COLOR, DEFAULT_PROJECT_ICON } from '@/constants/project-icon';
import userAPI from '@/api/user-api';

import './create-project-dialog.css';

const gettext = window.gettext;

const propTypes = {
  currentWorkspace: PropTypes.object.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired,
};

class CreateProjectDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      name: gettext('Untitled project'),
      icon: DEFAULT_PROJECT_ICON,
      bgColor: DEFAULT_COLOR,
      isCreatingProject: false,
      isDataLoaded: false,
      isSelectIconDialogOpen: false,
      projectCreated: [],
    };
  }

  componentDidMount() {
    let projectCreated = [];
    userAPI.getAccountInfo().then((res) => {
      let obj = {};
      obj.value = 'personal';
      obj.email = res.data.email;
      obj.label = 'Personal';
      projectCreated.push(obj);
      homeAPI.listGroups().then((res) => {
        for (let i = 0 ; i < res.data.length; i++) {
          let obj = {};
          obj.value = res.data[i].id;
          obj.email = res.data[i].id + '@seafile_group';
          obj.label = res.data[i].name;
          projectCreated.push(obj);
        }
        this.setState({ projectCreated, isDataLoaded: true });
      }).catch((error) => {
        this.handleError(error);
        this.props.onToggle();
      });
    }).catch((error) => {
      this.handleError(error);
      this.props.onToggle();
    });
  }

  onCreateProject = () => {
    const { name, icon, bgColor, projectCreated, isCreatingProject, isDataLoaded } = this.state;
    if (isCreatingProject || !isDataLoaded) return;

    const response = validateName(name);
    if (!response.isValid) {
      toaster.danger(response.message);
      return;
    }

    const { currentWorkspace } = this.props;
    let email;
    for (let i = 0; i < projectCreated.length; i++) {
      if ((currentWorkspace.type === 'personal' && projectCreated[i].value === 'personal') ||
        (currentWorkspace.type === 'group' && projectCreated[i].value === currentWorkspace.group_id)) {
        email = projectCreated[i].email;
        break;
      }
    }

    this.setState({ isCreatingProject: true });
    homeAPI.createProject(response.message, email, icon, bgColor, null).then((res) => {
      this.props.onSubmit(new Project(res.data.project));
    }).catch((error) => {
      this.setState({ isCreatingProject: false });
      this.handleError(error);
    });
  };

  onKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.onCreateProject();
    }
  };

  handleError = (error) => {
    const errorMessage = Utils.getErrorMsg(error, true);
    if (!error.response || error.response.status !== 403) {
      toaster.danger(errorMessage);
    }
  };

  onColorChange = (bgColor) => {
    this.setState({ bgColor });
  };

  onIconChange = (icon) => {
    this.setState({ icon });
  };

  onSelectIconDialogToggle = () => {
    this.setState({ isSelectIconDialogOpen: !this.state.isSelectIconDialogOpen });
  };

  onNameChange = (name) => {
    this.setState({ name });
  };

  render() {
    const { name, icon, bgColor, isCreatingProject, isDataLoaded, isSelectIconDialogOpen } = this.state;
    const { onToggle } = this.props;
    return (
      <>
        <Modal
          isOpen={true}
          toggle={onToggle}
          autoFocus={false}
          className="create-project-dialog"
        >
          <ModalHeader toggle={onToggle}>{gettext('Add project')}</ModalHeader>
          <ModalBody>
            <ProjectSettingContent
              name={name}
              bgColor={bgColor}
              icon={icon}
              onColorChange={this.onColorChange}
              onIconChange={this.onIconChange}
              onNameChange={this.onNameChange}
              onNameKeyDown={this.onKeyDown}
              onViewAll={this.onSelectIconDialogToggle}
              nameInputId="new-project-name"
            />
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
            <Button
              color="primary"
              onClick={this.onCreateProject}
              disabled={!isDataLoaded || !name.trim() || isCreatingProject}
            >
              {gettext('Submit')}
            </Button>
          </ModalFooter>
        </Modal>
        {isSelectIconDialogOpen && (
          <SelectProjectIconDialog
            currentIcon={icon}
            bgColor={bgColor}
            onSelect={this.onIconChange}
            onBack={this.onSelectIconDialogToggle}
          />
        )}
      </>
    );
  }
}

CreateProjectDialog.propTypes = propTypes;

export default CreateProjectDialog;
