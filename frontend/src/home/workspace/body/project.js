import React from 'react';
import PropTypes from 'prop-types';
import { IconButton, ProjectIcon, toaster } from '@/components';
import { Utils } from '@/utils/utils';
import { validateName } from '@/utils/validate';
import { ProjectSettingPopover } from '../../popover';
import { DEFAULT_COLOR } from '@/constants/project-icon';
import ProjectItemPopover from './project-item-popover';

const gettext = window.gettext;
const siteRoot = window.app.config.siteRoot;

const propTypes = {
  project: PropTypes.object.isRequired,
  onDeleteProjectToggle: PropTypes.func.isRequired,
  onAPITokenToggle: PropTypes.func,
  onUpdateProject: PropTypes.func.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  isOwner: PropTypes.bool.isRequired,
  isAdmin: PropTypes.bool.isRequired,
  onMobileUpdateProjectToggle: PropTypes.func,
  changeContainerColor: PropTypes.func,
  setDropdownState: PropTypes.func,
  getDropdownState: PropTypes.func,
  eventBus: PropTypes.object,
};

class Project extends React.Component {

  constructor(props) {
    super(props);
    const { name, color, icon } = props.project;
    this.state = {
      dropdownOpen: false,
      active: false,
      isShowSettings: false,
      name,
      bgColor: color,
      icon,
      isMouseEnter: false,
      isMoreOperationPopoverShow: false,
    };
    this.dropDownRef = React.createRef();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.props.project.name !== nextProps.project.name) {
      this.setState({ name: nextProps.project.name });
    }
  }

  componentWillUnmount() {
    if (this.props.eventBus) {
      this.unsubscribe();
    }
  }

  onMouseEnter = () => {
    if (this.props.getDropdownState && this.props.getDropdownState()) return;
    this.setState({ active: true });
  };

  onMouseLeave = () => {
    if (this.props.getDropdownState && this.props.getDropdownState()) return;
    if (this.state.isShowSettings) return;
    this.setState({ active: false, dropdownOpen: false });
  };

  onMobileUpdateProjectToggle = () => {
    this.props.onMobileUpdateProjectToggle(this.props.project);
  };

  onDeleteProjectToggle = () => {
    this.props.onDeleteProjectToggle(this.props.project);
  };

  dropdownToggle = (e) => {
    if (e.target.closest('.mobile-dropdown-item')) {
      return;
    }
    e.stopPropagation();
    if (this.state.dropdownOpen) {
      this.setState({ active: false });
    }
    if (this.props.setDropdownState) {
      this.props.setDropdownState(!this.state.dropdownOpen);
    }
    this.setState({ dropdownOpen: !this.state.dropdownOpen });
  };

  onProjectSettingsToggle = (e) => {
    if (e) e.stopPropagation();
    this.setState({ isShowSettings: !this.state.isShowSettings }, () => {
      if (!this.state.isShowSettings) {
        this.setState({ active: false });
        this.saveProjectProperty();
      }
    });
  };

  saveProjectProperty = () => {
    const { color, name, icon } = this.props.project;
    const { bgColor, icon: newIcon } = this.state;
    let newName = this.state.name.trim();
    let response = validateName(newName);
    if (!response.isValid) {
      toaster.danger(response.message);
      return;
    }
    newName = response.message;
    if (bgColor !== color || newIcon !== icon || newName !== name) {
      let updated = {};
      if (bgColor !== color) {
        updated.color = bgColor;
      }
      if (newIcon !== icon) {
        updated.icon = newIcon;
      }
      if (newName !== name) {
        updated.new_name = newName;
      }
      this.props.onUpdateProject(name, updated);
    }
  };

  onIconChange = (icon) => {
    this.setState({ icon });
  };

  onColorChange = (bgColor) => {
    this.setState({ bgColor });
  };

  onNameChange = (name) => {
    this.setState({ name });
  };

  onItemClick = (e, href) => {
    Utils.openPage(e, href);
  };

  onAdvancedMouseMove = (e) => {
    e.stopPropagation();
  };

  onAdvanceMenuMouseDown = () => {
    if (this.props.setDropdownState) {
      this.props.setDropdownState(false);
    }
  };

  toggleMoreOperation = (event) => {
    event && event.stopPropagation();
    this.setState({ isMoreOperationPopoverShow: !this.state.isMoreOperationPopoverShow });
  };

  render() {
    let { isOwner, isAdmin, project, className = '', style = {} } = this.props;
    let { name: newName, bgColor, icon, active, isMoreOperationPopoverShow } = this.state;
    let { workspace_id, id } = project;
    let projectHref = siteRoot + 'workspace/' + workspace_id + '/project/' + encodeURIComponent(project.name) + '/';
    const isDesktop = Utils.isDesktop();

    const projectColor = project.color || DEFAULT_COLOR;
    const projectStyle = { ...style };
    if (active || isMoreOperationPopoverShow) {
      projectStyle.background = `${projectColor}0F`; // opacity 6%
      projectStyle.border = `1.5px solid ${projectColor}80`; // opacity 50%
    } else {
      projectStyle.background = `linear-gradient(to bottom, ${projectColor}08, #FFFFFF08)`; // opacity 3% gradient
      projectStyle.border = `1.5px solid ${projectColor}33`; // opacity 20%
    }

    if (!isDesktop) {
      return (
        <div className="project-mobile-item" onClick={(e) => this.onItemClick(e, projectHref)}>
          <div className="project-mobile-icon">
            <ProjectIcon icon={project.icon} bgColor={project.color} />
          </div>
          <div className="project-mobile-name d-flex align-items-center">
            {newName}
          </div>
        </div>
      );
    }
    return (
      <div
        id={`project-item-${id}`}
        className={`project-item d-flex ${className}`}
        onClick={(e) => this.onItemClick(e, projectHref)}
        style={projectStyle}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >
        <div className="project-item-icon-more d-flex">
          <div
            className="project-item-icon d-flex align-items-center justify-content-center"
            style={{ backgroundColor: project.color || DEFAULT_COLOR }}
          >
            <i className={`project-item-icon-font icon-color-white project-icon project-icon-style ${project.icon || 'icon-worksheet'}`}></i>
          </div>
          {(active || isMoreOperationPopoverShow) && (isOwner || isAdmin) && (
            <IconButton className="no-hover-bg project-item-icon-more-toggle-btn" icon="more" onClick={this.toggleMoreOperation} title={gettext('More operations')} aria-label={gettext('More operations')} />
          )}
          {this.state.isMoreOperationPopoverShow && (
            <ProjectItemPopover
              target={`project-item-${id}`}
              project={project}
              onToggle={this.toggleMoreOperation}
              onProjectSettingsToggle={this.onProjectSettingsToggle}
              onAPITokenToggle={this.props.onAPITokenToggle}
              onDeleteProjectToggle={this.onDeleteProjectToggle}
            />
          )}
        </div>
        <div className="project-item-name" title={project.name}>
          {project.name}
        </div>
        <div className="project-item-group"></div>
        {this.state.isShowSettings && (
          <ProjectSettingPopover
            target={`project-item-${id}`}
            onToggle={this.onProjectSettingsToggle}
            name={newName}
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

Project.propTypes = propTypes;

export default Project;
