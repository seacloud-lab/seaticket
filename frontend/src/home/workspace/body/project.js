import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { Utils, validateName } from '../../../utils/utils';
import { ProjectSettingPopover } from '../../popover';
import ProjectIcon from './project-icon';

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

  onSetPasswordToggle = () => {
    this.props.onSetPasswordToggle(this.props.project);
  };

  onUnsetPasswordToggle = () => {
    this.props.onUnsetPasswordToggle(this.props.project);
  };

  onModifyPasswordToggle = () => {
    this.props.onModifyPasswordToggle(this.props.project);
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

  onTableItemClick = (e, href) => {
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

  render() {
    let { isOwner, isAdmin, project } = this.props;
    let { name: newName, dropdownOpen, bgColor, icon, active } = this.state;
    let { workspace_id, uuid, id, name, is_encrypted } = project;
    let tableHref = siteRoot + 'workspace/' + workspace_id + '/project/' + encodeURIComponent(project.name) + '/';
    const isDesktop = Utils.isDesktop();
    if (!isDesktop) {
      return (
        <div
          className="table-mobile-item"
          onClick={(e) => this.onTableItemClick(e, tableHref)}
        >
          <ProjectIcon bgColor={project.color} icon={project.icon} className="table-mobile-icon"/>
          <div className="table-mobile-name d-flex align-items-center">
            <a href={tableHref}>{name}</a>
            {is_encrypted && <i className='dtable-font dtable-icon-unlock star'></i>}
          </div>
          <div className="table-mobile-dropdown-menu">
            <Dropdown
              isOpen={this.state.dropdownOpen}
              toggle={this.dropdownToggle}
              direction="down"
              className="project-item-more-operation"
              onClick={(e) => {e.stopPropagation();}}
            >
              <DropdownToggle
                tag='i'
                role="button"
                className='dtable-font dtable-icon-more-vertical table-dropdown-menu-icon'
                title={gettext('More operations')}
                aria-label={gettext('More operations')}
                data-toggle="dropdown"
                aria-expanded={this.state.dropdownOpen}
                aria-haspopup={true}
              >
              </DropdownToggle>
              <div className={this.state.dropdownOpen ? '' : 'd-none'} onClick={this.dropdownToggle}>
                <div className="mobile-operation-menu-bg-layer"></div>
                <div className="mobile-operation-menu">
                  {(isOwner || isAdmin) &&
                    <Fragment>
                      <DropdownItem onClick={this.onMobileShareProjectToggle} className="mobile-dropdown-item">
                        <span className="dtable-font dtable-icon-share"></span>
                        <span className="mobile-dropdown-span">{gettext('Share')}</span>
                      </DropdownItem>
                      <DropdownItem onClick={this.onMobileUpdateProjectToggle} className="mobile-dropdown-item">
                        <span className="dtable-font dtable-icon-rename"></span>
                        <span className="mobile-dropdown-span">{gettext('Rename')}</span>
                      </DropdownItem>
                      <DropdownItem onClick={this.onDeleteProjectToggle} className="mobile-dropdown-item">
                        <span className="dtable-font dtable-icon-delete"></span>
                        <span className="mobile-dropdown-span">{gettext('Delete')}</span>
                      </DropdownItem>
                      <DropdownItem divider />
                    </Fragment>
                  }
                </div>
              </div>
            </Dropdown>
          </div>

        </div>
      );
    }
    const iconSettingsId = `table_item_${workspace_id}_${uuid}_${id}`;

    return (
      <div
        className={`project-item ${active ? 'tr-highlight' : ''}`}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
        onClick={(e) => this.onTableItemClick(e, tableHref)}
      >
        <div className="project-item-wrapper ml-0">
          <ProjectIcon bgColor={project.color} icon={project.icon} />
          <div className="project-name">
            <a href={tableHref}>{project.name}</a>
          </div>
        </div>
        <div className="table-dropdown-menu" ref={this.dropDownRef}>
          {active && (
            <Fragment>
              {(isOwner || isAdmin) && (
                <span
                  className="project-icon-settings"
                  onClick={this.onProjectSettingsToggle}
                  id={iconSettingsId}
                  title={gettext('Edit')}
                  aria-label={gettext('Edit')}
                >
                  <i className="dtable-font dtable-icon-rename cursor-pointer attr-action-icon"></i>
                </span>
              )}
              <Dropdown
                isOpen={dropdownOpen}
                toggle={this.dropdownToggle}
                direction="down"
                className="project-item-more-operation"
              >
                <DropdownToggle
                  tag='i'
                  role="button"
                  className='dtable-font dtable-icon-more-vertical cursor-pointer attr-action-icon table-dropdown-menu-icon'
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                  data-toggle="dropdown"
                  aria-expanded={dropdownOpen}
                  aria-haspopup={true}
                >
                </DropdownToggle>
                <DropdownMenu className="dtable-dropdown-menu dropdown-menu drop-list" right={true} onMouseMove={this.onDropDownMouseMove}>
                  {(isOwner || isAdmin) && <DropdownItem onClick={this.onShareProjectToggle}>{gettext('Share')}</DropdownItem>}
                  {(isOwner || isAdmin) && <DropdownItem onClick={this.onDeleteProjectToggle}>{gettext('Delete')}</DropdownItem>}
                </DropdownMenu>
              </Dropdown>
            </Fragment>
          )}
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

Project.propTypes = propTypes;

export default Project;
