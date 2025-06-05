import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownItem } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { gettext } from '../../../../utils/constants';
import SpecificWorkflowTaskListDialog from '../../../../workflow/components/dialog/specific-workflow-task-list-dialog';
import SpecificWorkflowTaskListView from '../../../../workflow/components/mobile/specific-workflow-task-list-view';
import { WORKFLOW_ICONS, WORKFLOW_COLORS, WORKFLOW_BACKGROUND_COLOR_MAP, WORKFLOW_HOVER_COLOR_MAP } from '../../../../workflow/constants';
import WorkflowItemPopover from '../../../../workflow/components/popover/workflow-item-popover';
import WorkflowSettingPopover from '../../../../workflow/components/popover/workflow-setting-popover';
import { Utils, validateName } from '../../../../utils/utils';
import CommonOperationConfirmationDialog from '../../../../components/dialog/common-operation-confirmation-dialog';
import ShareWorkflowDialog from '../../../../workflow/components/dialog/share-workflow-dialog';
import ModalPortal from '../../../../components/modal-portal';
import RenameBaseView from '../../mobile/rename-base-view';
import Icon from '../../../../components/icon';

const isDesktop = Utils.isDesktop();
const { server } = window.app.pageOptions;

class WorkflowItem extends React.Component {

  constructor(props) {
    super(props);
    const { name, icon, color, canCancelTask } = this.initWorkflowConfig(props);
    this.state = {
      isMouseEnter: false,
      isTasksContainerShow: false,
      isMoreOperationPopoverShow: false,
      isMoreOperationViewShow: false,
      isSettingPopoverShow: false,
      isSettingViewShow: false,
      isShareWorkflowDialogShow: false,
      isDeleteWorkflowDialogShow: false,
      name,
      icon,
      color,
      canCancelTask,
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { name, icon, color } = this.initWorkflowConfig(nextProps);
    if (this.state.name !== name) {
      this.setState({ name });
    }
    if (this.state.icon !== icon) {
      this.setState({ icon });
    }
    if (this.state.color !== color) {
      this.setState({ color });
    }
  }

  initWorkflowConfig = (props) => {
    const { workflowItem } = props;
    const { workflow_config } = workflowItem;
    const workflowConfig = JSON.parse(workflow_config);
    const { workflow_name, icon = WORKFLOW_ICONS[0], color = WORKFLOW_COLORS[0], can_cancel_task = false } = workflowConfig;
    return { name: workflow_name, icon, color, canCancelTask: can_cancel_task };
  };

  toggleShareWorkflowDialog = () => {
    this.setState({ isShareWorkflowDialogShow: !this.state.isShareWorkflowDialogShow });
  };

  toggleDeleteWorkflowDialog = () => {
    this.setState({ isDeleteWorkflowDialogShow: !this.state.isDeleteWorkflowDialogShow });
  };

  toggleWorkflowTasks = () => {
    this.setState({ isTasksContainerShow: !this.state.isTasksContainerShow }, () => {
      if (this.state.isTasksContainerShow && this.props.onItemClickHandler) {
        this.props.onItemClickHandler();
      }
    });
  };

  onMouseEnter = () => {
    this.setState({ isMouseEnter: true });
    const { setHighLightIndex, index } = this.props;
    if (setHighLightIndex) {
      setHighLightIndex(index);
    }
  };

  onMouseLeave = () => {
    this.setState({ isMouseEnter: false });
  };

  toggleWorkflowMoreOperation = (event) => {
    event && event.stopPropagation();
    if (isDesktop) {
      this.setState({ isMoreOperationPopoverShow: !this.state.isMoreOperationPopoverShow });
    } else {
      this.setState({ isMoreOperationViewShow: !this.state.isMoreOperationViewShow });
    }
  };

  toggleWorkflowSetting = () => {
    this.setState({ isSettingPopoverShow: !this.state.isSettingPopoverShow }, () => {
      if (this.state.isSettingPopoverShow) return;
      this.changeProperties();
    });
  };

  toggleSettingView = () => {
    this.setState({ isSettingViewShow: !this.state.isSettingViewShow }, () => {
      if (this.state.isSettingViewShow) return;
      this.changeProperties();
    });
  };

  changeProperties = () => {
    const { name: newName, icon: newIcon, color: newColor } = this.state;
    const { name: oldName, icon: oldIcon, color: oldColor } = this.initWorkflowConfig(this.props);
    const { workflowItem } = this.props;
    const { isValid: isValidName, message: validNewName } = validateName(newName);
    if (!isValidName) {
      this.setState({ name: oldName, icon: oldIcon, color: oldColor });
      toaster.danger(validNewName);
      return;
    }
    if (oldName !== validNewName || oldIcon !== newIcon || oldColor !== newColor) {
      let updates = {};
      if (oldName !== validNewName) {
        updates.workflow_name = validNewName;
      }
      if (oldIcon !== newIcon) {
        updates.icon = newIcon;
      }
      if (oldColor !== newColor) {
        updates.color = newColor;
      }
      const that = this;
      this.props.onUpdateWorkflowProperties(workflowItem, updates, (error) => {
        if (!error) return;
        that.setState({ name: oldName, icon: oldIcon, color: oldColor });
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
      });
    }
  };

  onDeleteWorkflow = () => {
    const { workflowItem } = this.props;
    this.props.onDeleteWorkflow(workflowItem, (error) => {
      if (!error) return;
      const errorMessage = gettext('Workflow deletion failed.');
      toaster.danger(errorMessage);
    });
  };

  onChange = (update) => {
    this.setState(update);
  };

  onUpdateItem = (name, update) => {
    this.setState({
      name: update.new_name || name,
      icon: update.icon,
      color: update.color
    });
  };

  onOpenWorkflowBase = () => {
    const { workflowItem } = this.props;
    const { dtable_name, workspace_id } = workflowItem;
    const baseUrl = `${server}/workspace/${workspace_id}/dtable/${Utils.encodePath(dtable_name)}/`;
    window.open(baseUrl, '_blank');
  };

  getRecordsDisplay = () => {
    const { workflowItem } = this.props;
    const count = workflowItem.is_admin ? workflowItem.ongoing_tasks_count : workflowItem.initiated_tasks_count;
    if (count <= 1) {
      return workflowItem.is_admin ? `${count} ${gettext('ongoing task')}` : `${count} ${gettext('submitted task')}`;
    } else {
      return workflowItem.is_admin ? `${count} ${gettext('ongoing tasks')}` : `${count} ${gettext('submitted tasks')}`;
    }
  };

  renderViewSettings = () => {
    return (
      <div onClick={this.toggleWorkflowMoreOperation}>
        <div className="mobile-operation-menu-bg-layer"></div>
        <div className="mobile-operation-menu">
          <Dropdown
            isOpen={this.state.isMoreOperationViewShow}
            toggle={() => {}}
            style={{ width: '100%' }}
          >
            <DropdownItem onClick={this.toggleSettingView} className="mobile-dropdown-item">
              <span className="dtable-font dtable-icon-rename"></span>
              <span className="mobile-dropdown-span">{gettext('Change name and icon')}</span>
            </DropdownItem>
            <DropdownItem onClick={this.toggleShareWorkflowDialog} className="mobile-dropdown-item">
              <span className="dtable-font workflow-access-permissions"><Icon symbol="access-permissions" /></span>
              <span className="mobile-dropdown-span">{gettext('Manage permissions')}</span>
            </DropdownItem>
            <DropdownItem onClick={this.onOpenWorkflowBase} className="mobile-dropdown-item">
              <span className="dtable-font dtable-icon-dtable-logo"></span>
              <span className="mobile-dropdown-span">{gettext('Open base')}</span>
            </DropdownItem>
            <DropdownItem onClick={this.toggleDeleteWorkflowDialog} className="mobile-dropdown-item">
              <span className="dtable-font dtable-icon-delete"></span>
              <span className="mobile-dropdown-span">{gettext('Delete workflow')}</span>
            </DropdownItem>
          </Dropdown>
        </div>
      </div>
    );
  };

  render() {
    const { workflowItem, className, style, targetId, isInMobileFolder, hideBackgroundColor, folders, currentFolder } = this.props;
    const { isTasksContainerShow, isMouseEnter, isMoreOperationPopoverShow, isSettingPopoverShow, name, icon, color, canCancelTask,
      isDeleteWorkflowDialogShow, isShareWorkflowDialogShow, isMoreOperationViewShow, isSettingViewShow } = this.state;
    const { id, count, is_admin, is_shared, token, group_name, group_owner, group_id: groupId } = workflowItem;
    const serverConfig = this.initWorkflowConfig(this.props);
    const workflowItemId = targetId ? `${targetId}-${groupId}-${id}` : `workflow-item-${groupId}-${id}`;
    const backgroundColorMap = isMouseEnter ? WORKFLOW_HOVER_COLOR_MAP : WORKFLOW_BACKGROUND_COLOR_MAP;
    const isDepart = group_owner === 'system admin';
    const hasPermission = is_admin && !is_shared;
    const foldersAvailable = folders?.length || currentFolder;
    let isWorkflowMoreShow;
    if (isDesktop) {
      // folders must be available to display the ‘show More’ operation if no manage permission
      isWorkflowMoreShow = isMouseEnter && (foldersAvailable || hasPermission);
    } else {
      isWorkflowMoreShow = hasPermission;
    }

    return (
      <>
        {isInMobileFolder &&
          <div className="workflow-mobile-item" onClick={this.toggleWorkflowTasks}>
            <div className="workflow-mobile-icon">
              <span className="workflow-icon-content" style={{ backgroundColor: color }}>
                <i className={`base-font dtable-icon-color-white ${icon}`}></i>
              </span>
            </div>
            <div className="workflow-mobile-name d-flex align-items-center">
              {name}
            </div>
            <div
              className="workflow-item-more d-flex justify-content-center"
              onClick={isWorkflowMoreShow ? this.toggleWorkflowMoreOperation : () => {}}
            >
              {isWorkflowMoreShow &&
                <i
                  className="dtable-font dtable-icon-more-vertical"
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                >
                </i>
              }
            </div>
          </div>
        }
        {!isInMobileFolder &&
          <div
            id={workflowItemId}
            className={`workflow-item d-flex ${className}`}
            onClick={this.toggleWorkflowTasks}
            style={{
              ...style,
              backgroundColor: hideBackgroundColor ? null : backgroundColorMap[serverConfig.color],
            }}
            onMouseEnter={this.onMouseEnter}
            onMouseLeave={this.onMouseLeave}
          >
            <div className="workflow-item-icon-more d-flex">
              <div
                className="workflow-item-icon d-flex align-items-center justify-content-center"
                style={{ backgroundColor: serverConfig.color }}
              >
                <i
                  className={`workflow-item-icon-font dtable-icon-color-white base-font ${serverConfig.icon}`}
                >
                </i>
              </div>
              {isWorkflowMoreShow &&
                <div
                  className="workflow-item-more d-flex justify-content-center"
                  onClick={this.toggleWorkflowMoreOperation}
                >
                  <i
                    className="dtable-font dtable-icon-more-level"
                    title={gettext('More operations')}
                    aria-label={gettext('More operations')}
                  >
                  </i>
                </div>
              }
            </div>
            <div className="workflow-item-name" title={serverConfig.name}>
              {serverConfig.name}
            </div>
            <div className="workflow-item-group text-truncate">
              <i
                className={`table-workspace-icon dtable-font dtable-icon-${
                  isDepart ? 'department' : 'collaborator'
                }`}
              >
              </i>
              {group_name}
            </div>
            <div className="workflow-item-records text-truncate" title={count}>
              {this.getRecordsDisplay()}
            </div>
          </div>
        }
        {isMoreOperationViewShow && this.renderViewSettings()}
        {isTasksContainerShow &&
          (isDesktop ? (
            <SpecificWorkflowTaskListDialog
              workflow={workflowItem}
              canCancelTask={canCancelTask}
              toggleWorkflowTasksDialog={this.toggleWorkflowTasks}
              refreshPendingtasksCount={this.props.refreshPendingtasksCount}
            />
          ) : (
            <ModalPortal>
              <SpecificWorkflowTaskListView
                workflow={workflowItem}
                canCancelTask={canCancelTask}
                toggleWorkflowTasksView={this.toggleWorkflowTasks}
                refreshPendingtasksCount={this.props.refreshPendingtasksCount}
              />
            </ModalPortal>
          ))}
        {isMoreOperationPopoverShow && (
          <WorkflowItemPopover
            target={workflowItemId}
            workflow={workflowItem}
            folders={folders}
            currentFolder={currentFolder}
            isManaged={this.props.isManaged}
            onToggle={this.toggleWorkflowMoreOperation}
            onOpenWorkflowBase={this.onOpenWorkflowBase}
            onModifyNameAndIcon={this.toggleWorkflowSetting}
            onShareWorkflow={this.toggleShareWorkflowDialog}
            onDeleteWorkflow={this.toggleDeleteWorkflowDialog}
            onMoveWorkflowToFolder={this.props.onMoveWorkflowToFolder}
          />
        )}
        {isSettingPopoverShow && (
          <WorkflowSettingPopover
            target={workflowItemId}
            name={name}
            icon={icon}
            color={color}
            onChange={this.onChange}
            onToggle={this.toggleWorkflowSetting}
          />
        )}
        {isDeleteWorkflowDialogShow && (
          <CommonOperationConfirmationDialog
            title={gettext('Delete workflow')}
            message={gettext('Are you sure you want to delete workflow {placeholder} ?').replace('{placeholder}', `<b>${serverConfig.name}</b>`)}
            executeOperation={this.onDeleteWorkflow}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.toggleDeleteWorkflowDialog}
          />
        )}
        {isShareWorkflowDialogShow && (
          <ShareWorkflowDialog
            workflowName={serverConfig.name}
            appToken={token}
            dtableGroupId={groupId + ''}
            shareCancel={this.toggleShareWorkflowDialog}
          />
        )}
        {isSettingViewShow && (
          <ModalPortal>
            <RenameBaseView
              isWorkflow={true}
              onMobileUpdateItemToggle={this.toggleSettingView}
              currentItem={{ name, icon, color }}
              onUpdateItem={this.onUpdateItem}
            />
          </ModalPortal>
        )}
      </>
    );
  }
}

WorkflowItem.defaultProps = {
  isInMobileFolder: false
};

WorkflowItem.propTypes = {
  isInMobileFolder: PropTypes.bool,
  workflowItem: PropTypes.object,
  folders: PropTypes.array,
  className: PropTypes.string,
  style: PropTypes.object,
  index: PropTypes.number,
  targetId: PropTypes.string,
  currentFolder: PropTypes.object,
  isManaged: PropTypes.bool,
  onMoveWorkflowToFolder: PropTypes.func,
  onUpdateWorkflowProperties: PropTypes.func,
  onDeleteWorkflow: PropTypes.func,
  onShareWorkflowToGroup: PropTypes.func,
  onDeleteSharedGroupWorkflow: PropTypes.func,
  refreshPendingtasksCount: PropTypes.func,
  setHighLightIndex: PropTypes.func,
  onItemClickHandler: PropTypes.func,
  hideBackgroundColor: PropTypes.bool,
};

export default WorkflowItem;
