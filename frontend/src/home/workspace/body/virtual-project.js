import React from 'react';
import PropTypes from 'prop-types';
import { toaster } from '@/components';
import homeAPI from '../../api';
import Project from '../../models/project';
import { Utils } from '@/utils/utils';
import { validateName } from '@/utils/validate';
import { ProjectSettingPopover } from '../../popover';
import { DEFAULT_COLOR } from '@/constants/project-icon';
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
      bgColor: DEFAULT_COLOR,
      isChange: true,
      isCreatingProject: false,
      isDataLoaded: false,
      projectCreated: [],
    };
    this.ref = null;
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

  renderSettingPopover = () => {
    let { style = {} } = this.props;
    const { name, icon, bgColor } = this.state;
    const { right } = this.ref.getBoundingClientRect();
    const offsetX = window.innerWidth - right > style.width ? 0 : style.width - 314 - 12;
    return (
      <ProjectSettingPopover
        modifiers={[
          { name: 'preventOverflow', options: { boundary: document.body } },
          { name: 'offset', options: { offset: [offsetX, 0] } },
        ]}
        className="virtual-project-settings"
        placement="bottom-start"
        target={this.ref}
        onToggle={this.onCreateProject}
        name={name}
        bgColor={bgColor}
        icon={icon}
        onColorChange={this.onColorChange}
        onIconChange={this.onIconChange}
        onNameChange={this.onNameChange}
      />
    );
  };

  render() {
    let { className = '', style = {} } = this.props;
    const { name, icon, bgColor } = this.state;
    return (
      <div
        className={`project-item d-flex ${className}`}
        ref={ref => this.ref = ref}
        style={{
          ...style,
          backgroundColor: `${bgColor}0F`, // opacity 6%
          border: `1.5px solid ${bgColor}80`, // opacity 50%
        }}
      >
        <div className="w-100 d-flex justify-content-between">
          <div className="project-item-icon">
            <i className={`project-icon project-icon-style ${icon || 'icon-worksheet'}`} style={{ color: bgColor || DEFAULT_COLOR }}></i>
          </div>
        </div>
        <div className="project-item-name" title={name}>
          {name}
        </div>
        {this.state.isDataLoaded && (
          <>{this.renderSettingPopover()}</>
        )}
      </div>
    );
  }
}

VirtualProject.propTypes = propTypes;

export default VirtualProject;
