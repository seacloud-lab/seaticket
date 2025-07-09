import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { Utils } from '../../../utils/utils';
import { siteRoot, gettext, canAddProject } from '../../../constants';
import { UserInfoPopover } from '../../../components/popover';
import ProjectIcon from './project-icon';
import { PROJECT_BACKGROUND_COLOR_MAP, PROJECT_HOVER_COLOR_MAP } from '../constants';

class DTableItemGroupShared extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      active: false,
      dropdownOpen: false,
      isUserDetailPopoverShow: false,
      isCopyToCurrentGroupShow: false,
      isPasswordDialogShow: false,
      pwd: ''
    };
  }

  onMouseEnter = () => {
    if (this.props.getDropdownState && this.props.getDropdownState()) return;
    if (!this.props.isItemFreezed) {
      this.setState({ active: true });
    }
  };

  onMouseLeave = () => {
    if (this.props.getDropdownState && this.props.getDropdownState()) return;
    if (!this.props.isItemFreezed) {
      this.setState({ active: false });
    }
  };

  onShareMouseEnter = () => {
    const _this = this;
    this.handleTimer = setTimeout(() => {
      _this.setState({ isUserDetailPopoverShow: true });
    }, 500);
  };

  onShareMouseLeave = () => {
    clearTimeout(this.handleTimer);
    this.setState({ isUserDetailPopoverShow: false });
  };

  onLeaveShare = (e) => {
    e.stopPropagation();
    this.props.onLeaveShare(this.props.project);
  };

  dropdownToggle = () => {
    if (this.state.dropdownOpen) {
      this.setState({ active: false });
    }
    if (this.props.setDropdownState) {
      this.props.setDropdownState(!this.state.dropdownOpen);
    }
    this.setState({ dropdownOpen: !this.state.dropdownOpen });
  };

  onItemClick = (e, href) => {
    Utils.openPage(e, href);
  };

  onCopyProjectToggle = () => {
    this.props.onCopyProjectToggle(this.props.project);
  };

  toggleCopyDTableToCurrentGroup = () => {
    this.setState({ isCopyToCurrentGroupShow: !this.isCopyToCurrentGroupShow });
  };

  onCopyDTableToCurrentGroup = () => {
    const { project } = this.props;
    const { is_encrypted } = project;
    if (is_encrypted) {
      this.togglePwdDialog();
    } else {
      this.toggleCopyDTableToCurrentGroup();
    }
  };

  togglePwdDialog = () => {
    this.setState({ isPasswordDialogShow: !this.state.isPasswordDialogShow });
  };

  render() {
    const { isUserDetailPopoverShow } = this.state;
    let { project, isAdmin, sharedItemKey, className = '', style = {}, workspace } = this.props;
    let { name, workspace_id, from_user, from_user_name, from_user_avatar, from_group_avatar, from_group_name,
      color, icon, view_share_id, shared_name, is_encrypted, permission, uuid, id } = project;
    let isFromGroup = from_user ? from_user.indexOf('@seafile_group') !== -1 : true;
    let projectHref = siteRoot + 'workspace/' + workspace_id + '/project/' + encodeURIComponent(name) + '/';
    if (view_share_id !== undefined) {
      projectHref = `${siteRoot}project-shared-view/group/${view_share_id}/`;
    }
    let canCopy = !view_share_id && canAddProject && (permission === 'r' || permission === 'rw');
    const isDesktop = Utils.isDesktop();
    const active = this.state.active;
    const displayName = isFromGroup ? from_group_name : from_user_name;
    const displayAvatar = isFromGroup ? from_group_avatar : from_user_avatar;
    const backgroundColorMap = active ? PROJECT_HOVER_COLOR_MAP : PROJECT_BACKGROUND_COLOR_MAP;
    const iconSettingsId = `table_item_${workspace_id}_${uuid}_${id}`;

    if (isDesktop) {
      return (
        <div
          id={id}
          className={`project-item d-flex ${className}`}
          onClick={(e) => this.onItemClick(e, projectHref)}
          style={{
            ...style,
            backgroundColor: backgroundColorMap[project.color || '#FF8000'],
          }}
          onMouseEnter={this.onMouseEnter}
          onMouseLeave={this.onMouseLeave}
        >
          <div className="project-item-icon-more d-flex">
            <div
              className="project-item-icon d-flex align-items-center justify-content-center"
              style={{ backgroundColor: project.color || '#FF8000' }}
            >
              <i
                className={`project-item-icon-font icon-color-white project-icon project-icon-style ${project.icon || 'icon-worksheet'}`}
              >
              </i>
            </div>
            {active &&
              <Dropdown
                isOpen={this.state.dropdownOpen}
                toggle={this.dropdownToggle}
                direction="down"
                className="project-item-more-operation"
                onClick={(e) => {e.stopPropagation();}}
              >
                <DropdownToggle
                  tag="i"
                  role="button"
                  className="dtable-font dtable-icon-more-level cursor-pointer attr-action-icon table-dropdown-menu-icon"
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                  data-toggle="dropdown"
                  aria-expanded={this.state.dropdownOpen}
                  aria-haspopup={true}
                />
                <DropdownMenu className="sea-qa-dropdown-menu dropdown-menu">
                  {isAdmin && <DropdownItem onClick={this.onLeaveShare}>{gettext('Leave share')}</DropdownItem>}
                  {canCopy && <DropdownItem onClick={this.onCopyProjectToggle}>{gettext('Copy')}</DropdownItem>}
                  {isAdmin && canCopy && <DropdownItem onClick={this.onCopyDTableToCurrentGroup}>{gettext('Copy to current group')}</DropdownItem>}
                </DropdownMenu>
              </Dropdown>
            }
          </div>
          <div className="project-item-name project-name" title={shared_name || name} id={iconSettingsId}>
            <a className="table-href" href={projectHref}>{shared_name || name}</a>
          </div>
          <div
            className="dtable-sharer-information"
            onMouseEnter={this.onShareMouseEnter}
            onMouseLeave={this.onShareMouseLeave}
            id={`shared-item-group-${sharedItemKey}`}
          >
            <img className="dtable-sharer-avatar" src={displayAvatar} alt={displayName} />
            <span className="dtable-sharer-name">{displayName}</span>
            <UserInfoPopover
              target={iconSettingsId}
              isUserDetailPopoverShow={!isFromGroup && isUserDetailPopoverShow}
              userEmail={from_user}
            >
            </UserInfoPopover>
          </div>
          <div className="project-item-group text-truncate">
            <i className={'table-workspace-icon dtable-font dtable-icon-collaborator'}></i>
            {workspace.name}
          </div>
        </div>
      );
    }

    return (
      <div
        className="table-mobile-item"
        onClick={(e) => this.onItemClick(e, projectHref)}
      >
        <ProjectIcon bgColor={color} icon={icon} className="table-mobile-icon"/>
        <div className="table-mobile-name d-flex align-items-center">
          <a className="table-href" href={projectHref}>{shared_name || name}</a>
          <div className="dtable-sharer-information">
            <img className="dtable-sharer-avatar" src={displayAvatar} alt={displayName} />
            <span className="dtable-sharer-name">{displayName}</span>
          </div>
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
              tag="i"
              role="button"
              className="dtable-font dtable-icon-more-vertical cursor-pointer attr-action-icon table-dropdown-menu-icon"
              title={gettext('More operations')}
              aria-label={gettext('More operations')}
              data-toggle="dropdown"
              aria-expanded={this.state.dropdownOpen}
              aria-haspopup={true}
            />
            <div className={this.state.dropdownOpen ? '' : 'd-none'} onClick={this.dropdownToggle}>
              <div className="mobile-operation-menu-bg-layer"></div>
              <div className="mobile-operation-menu">
                {isAdmin &&
                  <DropdownItem onClick={this.onLeaveShare} className="mobile-dropdown-item">
                    <span className="dtable-font dtable-icon-x"></span>
                    <span className="mobile-dropdown-span">{gettext('Leave share')}</span>
                  </DropdownItem>
                }
              </div>
            </div>
          </Dropdown>
        </div>
      </div>
    );
  }
}

DTableItemGroupShared.propTypes = {
  isItemFreezed: PropTypes.bool.isRequired,
  sharedItemKey: PropTypes.string,
  project: PropTypes.object.isRequired,
  onLeaveShare: PropTypes.func.isRequired,
  isAdmin: PropTypes.bool.isRequired,
  setDropdownState: PropTypes.func,
  getDropdownState: PropTypes.func,
  onCopyProjectToggle: PropTypes.func,
  onCopyProject: PropTypes.func,
  currentWorkspace: PropTypes.object,
};

export default DTableItemGroupShared;
