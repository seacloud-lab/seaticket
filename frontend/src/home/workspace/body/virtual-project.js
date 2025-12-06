import React from 'react';
import PropTypes from 'prop-types';
import { Icon, toaster } from '@/components';
import homeAPI from '../../api';
import Project from '../../models/project';
import { Utils } from '@/utils/utils';
import { validateName } from '@/utils/validate';
import { ProjectSettingPopover } from '../../popover';
import { PROJECT_BACKGROUND_COLOR_MAP, DEFAULT_COLOR } from '../constants';
import userAPI from '@/api/user-api';

const gettext = window.gettext;

const propTypes = {
  currentWorkspace: PropTypes.object,
  createBlankProject: PropTypes.func,
  hideVirtualProject: PropTypes.func,
};

class VirtualProject extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      name: gettext('Untitled project'),
      icon: '',
      bgColor: '',
      isChange: true,
      isCreatingProject: false,
      isDataLoaded: false,
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
      }).catch((err) => {
        this.handleError(err);
        this.props.hideVirtualProject();
      });
    }).catch((error) => {
      this.handleError(error);
      this.props.hideVirtualProject();
    });
  }

  onCreateProject = () => {
    const { name, icon, bgColor, projectCreated, isChange, isCreatingProject } = this.state;
    if (!isChange || isCreatingProject) return;
    const { currentWorkspace } = this.props;
    let response = validateName(name);
    if (!response.isValid) {
      toaster.danger(response.message);
      return;
    }
    let email;
    if (currentWorkspace) {
      for (let i = 0; i < projectCreated.length; i++) {
        if ((currentWorkspace.type === 'personal' && projectCreated[i].value === 'personal') ||
          (currentWorkspace.type === 'group' && projectCreated[i].value === currentWorkspace.group_id)) {
          email = projectCreated[i].email;
          break;
        }
      }
    }
    this.setState({ isCreatingProject: true });
    homeAPI.createProject(response.message, email, icon, bgColor, null).then((res) => {
      let newProject = new Project(res.data.project);
      this.props.createBlankProject(newProject);
      this.setState({ isCreatingProject: false });
    }).catch((error) => {
      this.setState({ isChange: false, isCreatingProject: false });
      this.handleError(error);
    });
  };

  handleError = (err) => {
    let errMsg = Utils.getErrorMsg(err, true);
    if (!err.response || err.response.status !== 403) {
      toaster.danger(errMsg);
    }
  };

  onColorChange = (bgColor) => {
    this.setState({ bgColor, isChange: true });
  };

  onIconChange = (icon) => {
    this.setState({ icon, isChange: true });
  };

  onNameChange = (name) => {
    this.setState({ name, isChange: true });
  };

  render() {
    let { className = '', style = {}, currentWorkspace } = this.props;
    const { name, icon, bgColor } = this.state;
    const backgroundColorMap = PROJECT_BACKGROUND_COLOR_MAP;
    return (
      <div
        className={`project-item d-flex ${className}`}
        id="create-project"
        style={{
          ...style,
          backgroundColor: backgroundColorMap[bgColor] || backgroundColorMap[DEFAULT_COLOR],
        }}
      >
        <div className="project-item-icon-more d-flex">
          <div
            className="project-item-icon d-flex align-items-center justify-content-center"
            style={{ backgroundColor: bgColor || DEFAULT_COLOR }}
          >
            <i className={`project-item-icon-font icon-color-white project-icon project-icon-style ${icon || 'icon-worksheet'}`}></i>
          </div>
        </div>
        <div className="project-item-name" title={name}>
          {name}
        </div>
        <div className="project-item-group text-truncate">
          <Icon symbol="collaborator" className="project-workspace-icon" />
          {currentWorkspace.name}
        </div>
        {this.state.isDataLoaded && (
          <ProjectSettingPopover
            className="virtual-project-settings"
            placement="bottom-start"
            target="create-project"
            onToggle={this.onCreateProject}
            name={name}
            bgColor={bgColor}
            icon={icon}
            onColorChange={this.onColorChange}
            onIconChange={this.onIconChange}
            onNameChange={this.onNameChange}
          />
        )}
      </div>
    );
  }
}

VirtualProject.propTypes = propTypes;

export default VirtualProject;
