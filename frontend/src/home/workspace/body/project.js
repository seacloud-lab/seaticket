import React from 'react';
import PropTypes from 'prop-types';
import { toaster } from '../../../components';
import { Utils, validateName } from '../../../utils/utils';
import { ProjectSettingPopover } from '../../popover';
import { PROJECT_BACKGROUND_COLOR_MAP, PROJECT_HOVER_COLOR_MAP, DEFAULT_COLOR } from '../constants';
import ProjectItemPopover from './project-item-popover';

const gettext = window.gettext;
const siteRoot = window.app.config.siteRoot;

const propTypes = {
  project: PropTypes.object.isRequired,
  onDeleteProjectToggle: PropTypes.func.isRequired,
  onShareProjectToggle: PropTypes.func.isRequired,
  onUpdateProject: PropTypes.func.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  isOwner: PropTypes.bool.isRequired,
  isAdmin: PropTypes.bool.isRequired,
  onMobileShareProjectToggle: PropTypes.func,
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
      name: name,
      bgColor: color,
      icon: icon,
      advancedDropdownOpen: false,
      isFinished: false,
      isShowConfirmExportDialog: false,
      ignore_asset: 'false',
      size_limit: 0,
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

  onShareProjectToggle = () => {
    this.props.onShareProjectToggle(this.props.project);
  };

  onMobileShareProjectToggle = () => {
    this.props.onMobileShareProjectToggle(this.props.project);
  };

  onConfirmExportDialogToggle = () => {
    this.setState({ isShowConfirmExportDialog: !this.state.isShowConfirmExportDialog });
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
        this.saveBaseProperty();
      }
    });
  };

  saveBaseProperty = () => {
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

  toggleAdvancedMenu = (e) => {
    e.stopPropagation();
    this.setState({
      advancedDropdownOpen: !this.state.advancedDropdownOpen
    });
  };

  onAdvancedMouseEnter = () => {
    this.setState({
      advancedDropdownOpen: true
    });
  };

  onDropDownMouseMove = (e) => {
    if (this.state.advancedDropdownOpen && e.target && e.target.className === 'dropdown-item') {
      this.setState({
        advancedDropdownOpen: false
      });
    }
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
    let { isOwner, isAdmin, project, className = '', style = {}, workspace } = this.props;
    let { name: newName, bgColor, icon, active } = this.state;
    let { workspace_id, uuid, id, is_encrypted } = project;
    let projectHref = siteRoot + 'workspace/' + workspace_id + '/project/' + encodeURIComponent(project.name) + '/';
    const isDesktop = Utils.isDesktop();
    const iconSettingsId = `table_item_${workspace_id}_${uuid}_${id}`;
    const backgroundColorMap = active ? PROJECT_HOVER_COLOR_MAP : PROJECT_BACKGROUND_COLOR_MAP;

    if (!isDesktop) {
      return (
        <div className="project-mobile-item" onClick={(e) => this.onItemClick(e, projectHref)}>
          <div className="project-mobile-icon">
            <span className="project-icon-content" style={{ backgroundColor: project.color || DEFAULT_COLOR }}>
              <i className={`base-font ${project.icon || 'project-icon icon-color-white icon-worksheet project-icon-style'}`}></i>
            </span>
          </div>
          <div className="project-mobile-name d-flex align-items-center">
            {newName}
            {is_encrypted && <i className='dtable-font dtable-icon-unlock star'></i>}
          </div>
          <div
            className="project-item-more d-flex justify-content-center">
            <i className="dtable-font dtable-icon-more-vertical" title={gettext('More operations')} aria-label={gettext('More operations')}></i>
          </div>
        </div>
      );
    } else {
      return (
        <div
          id={`project-item-${id}`}
          className={`project-item d-flex ${className}`}
          onClick={(e) => this.onItemClick(e, projectHref)}
          style={{
            ...style,
            backgroundColor: backgroundColorMap[project.color || DEFAULT_COLOR],
          }}
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
            {active && (isOwner || isAdmin) &&
              <div className="d-flex justify-content-center" onClick={this.toggleMoreOperation}>
                <i className="dtable-font dtable-icon-more-level" title={gettext('More operations')} aria-label={gettext('More operations')} />
              </div>
            }
            {this.state.isMoreOperationPopoverShow && (
              <ProjectItemPopover
                target={`project-item-${id}`}
                onToggle={this.toggleMoreOperation}
                onProjectSettingsToggle={this.onProjectSettingsToggle}
                onShareProjectToggle={this.onShareProjectToggle}
                onDeleteProjectToggle={this.onDeleteProjectToggle}
              />
            )}
          </div>
          <div className="project-item-name" title={newName} id={iconSettingsId}>
            {newName}
            {is_encrypted && <i className='dtable-font dtable-icon-unlock star'></i>}
          </div>
          <div className="project-item-group text-truncate">
            <i className='table-workspace-icon dtable-font dtable-icon-collaborator'></i>
            {workspace.name}
          </div>
          {this.state.isShowSettings && (
            <ProjectSettingPopover
              target={iconSettingsId}
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
}

Project.propTypes = propTypes;

export default Project;
