import React from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { UncontrolledTooltip } from 'reactstrap';
import {
  CellType,
  getNumberDisplayString,
  getDateDisplayString,
  getGeolocationDisplayString,
  getDurationDisplayString,
} from 'dtable-utils';
import { getPreviewContent } from '@seafile/seafile-editor';
import { gettext, mediaUrl } from '../../../../utils/constants';
import { getFileIconUrl } from '../../../../components-form/utils/utils';
import WorkflowTaskItemPopover from '../../popover/workflow-task-item-popover';
import { NODE_TYPE } from '../../../constants';
import { transferAssetURL } from '../../../utils/asset';
import ManageTaskParticipantsDialog from '../manage-task-participants-dialog';
import CancelTaskDialog from '../cancel-task-dialog';
import DigitalSignUtils from '../../../../components-form/cell-editor-widgets/digital-sign-editor/digital-sign-utils';
import DeleteTaskDialog from '../delete-task-dialog';
import ResubmitTaskDialog from '../resubmit-task-dialog';

class WorkflowTaskItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isMoreOperationPopoverShow: false,
      isManageParticipantsShow: false,
      isCancelTaskDialogShow: false,
      isDeleteTaskDialogShow: false,
      isResubmitTaskDialogShow: false,
    };
    this.workflow_config = JSON.parse(props.workflowTask.dtable_workflow.workflow_config);
    this.forbiddenCancelStates = ['canceled', 'finished'];
  }

  onClickTask = () => {
    const { workflowTask } = this.props;
    if (!workflowTask.is_valid) return;
    this.props.openWorkflowTask(workflowTask);
  };

  toggleTaskMoreOperation = (event) => {
    event && event.stopPropagation();
    this.setState({ isMoreOperationPopoverShow: !this.state.isMoreOperationPopoverShow });
  };

  onDeleteWorkflowTask = () => {
    const { workflowTask } = this.props;
    this.props.onDeleteWorkflowTask(workflowTask.id);
  };

  toggleManageParticipants = () => {
    this.setState({ isManageParticipantsShow: !this.state.isManageParticipantsShow });
  };

  toggleCancelTask = () => {
    this.setState({ isCancelTaskDialogShow: !this.state.isCancelTaskDialogShow });
  };

  toggleDeleteTask = () => {
    this.setState({ isDeleteTaskDialogShow: !this.state.isDeleteTaskDialogShow });
  };

  toggleResubmitTask = () => {
    this.setState({ isResubmitTaskDialogShow: !this.state.isResubmitTaskDialogShow });
  };

  onCancelTask = () => {
    const { workflowTask } = this.props;
    this.props.onCancelTask(workflowTask.id);
  };

  onResubmitTask = () => {
    const { workflowTask } = this.props;
    this.props.onResubmitTask(workflowTask.id);
  };

  onUpdateParticipants = (participants) => {
    const { workflowTask } = this.props;
    this.props.onUpdateParticipants(workflowTask.id, participants);
  };

  renderOption = (option) => {
    const { name, color, textColor } = option;
    const { workflowTask } = this.props;
    const { id } = workflowTask;
    return (
      <div className="workflow-task-item-state-display" id={`workflow-task-item-header-state-${id}`}>
        <span
          className="workflow-task-item-state-option"
          style={{ color: textColor, backgroundColor: color }}
        >
          {name}
        </span>
      </div>
    );
  };

  renderValue = (submittedValue) => {
    const { workflowTask } = this.props;
    const { column_type, column_data, value, column_key } = submittedValue;
    switch (column_type) {
      case CellType.SINGLE_SELECT: {
        if (!value) return <span className="row-cell-value-empty"></span>;
        if (!Array.isArray(column_data.options) || column_data.options.length === 0) return null;
        const option = column_data.options.find(option => option.id === value);
        if (!option) return null;
        const { textColor, color, name } = option;
        return (
          <span
            className="workflow-task-item-submitted-option"
            style={{ color: textColor, backgroundColor: color }}
          >
            {name}
          </span>
        );
      }
      case CellType.MULTIPLE_SELECT: {
        if (!value) return <span className="row-cell-value-empty mt-2"></span>;
        if (!Array.isArray(column_data.options) || column_data.options.length === 0) return null;
        const validValue = Array.isArray(value) ? value : [value];
        const validValueOptions = column_data.options.filter(option => validValue.includes(option.id));
        return validValueOptions.map(option => {
          const { textColor, color, name, id } = option;
          return (
            <span
              key={id}
              className="workflow-task-item-submitted-option"
              style={{ color: textColor, backgroundColor: color }}
            >
              {name}
            </span>
          );
        });
      }
      case CellType.COLLABORATOR: {
        if (!Array.isArray(value) || value.length === 0) return <span className="row-cell-value-empty"></span>;
        return value.map((collaborator) => {
          return (
            <div key={collaborator.email} className='collaborator-option-item'>
              <span className='collaborator-avatar'>
                <img className='collaborator-icon' alt={collaborator.name} src={collaborator.avatar_url} />
              </span>
              <span className='collaborator-name text-truncate'>{collaborator.name ? collaborator.name : gettext('Unknown')}</span>
            </div>
          );
        });
      }
      case CellType.CHECKBOX: {
        return (
          <input type='checkbox' checked={value ? 'checked' : ''} disabled={true} className="mt-1" />
        );
      }
      case CellType.DATE: {
        if (!value) return <span className="row-cell-value-empty"></span>;
        const { format } = column_data || {};
        return getDateDisplayString(value, format);
      }
      case CellType.GEOLOCATION: {
        if (!value) return <span className="row-cell-value-empty"></span>;
        return getGeolocationDisplayString(value, column_data, { hyphen: ' ' });
      }
      case CellType.NUMBER: {
        if (!value) return <span className="row-cell-value-empty"></span>;
        return getNumberDisplayString(value, column_data || {});
      }
      case CellType.DURATION: {
        if (!value) return <span className="row-cell-value-empty"></span>;
        return getDurationDisplayString(value, column_data || {});
      }
      case CellType.RATE: {
        if (!value) return <span className="row-cell-value-empty mt-2"></span>;
        const {
          rate_max_number = 5,
          rate_style_color = '#e5e5e5',
          rate_style_type = 'dtable-icon-rate'
        } = column_data || {};
        const validValue = Math.min(rate_max_number, value);
        let rateList = [];
        for (let i = 0; i < validValue; i++) {
          rateList.push(
            <i
              key={`workflow-rate-value-${i}`}
              className={`dtable-font ${rate_style_type}`}
              style={{ color: rate_style_color || '#e5e5e5' }}
            >
            </i>
          );
        }
        return rateList;
      }
      case CellType.LONG_TEXT: {
        if (!value) return <span className="row-cell-value-empty mt-2"></span>;
        let validValue = value;
        if (typeof value === 'string') {
          validValue = getPreviewContent(value);
        }
        if (!validValue) return null;
        const { previewText, images, links } = validValue;
        const linksLen = links ? links.length : 0;
        const imagesLen = images ? images.length : 0;
        let firstImageURL;
        if (imagesLen) {
          firstImageURL = transferAssetURL(images[0], workflowTask.dtable_workflow.token, workflowTask.id, column_key, CellType.LONG_TEXT);
        }
        return (
          <>
            {linksLen > 0 && (
              <div className="workflow-longtext-icon-container workflow-longtext-links-container">
                <i className="dtable-font dtable-icon-url"></i>{links.length}
              </div>
            )}
            {imagesLen > 0 && (
              <div className="workflow-longtext-icon-container workflow-longtext-images-container">
                <img src={firstImageURL} alt="" className="workflow-longtext-image" />
                {imagesLen > 1 && (
                  <i className="workflow-longtext-image-count">{'+'}{imagesLen}</i>
                )}
              </div>
            )}
            {<div className="workflow-longtext-preview-text text-truncate">{previewText}</div>}
          </>
        );
      }
      case CellType.IMAGE: {
        if (!Array.isArray(value) || value.length === 0) return <span className="row-cell-value-empty"></span>;
        const imagesLen = value.length;
        const firstImageURL = transferAssetURL(value[0], workflowTask.dtable_workflow.token, workflowTask.id, column_key, CellType.IMAGE);
        return (
          <>
            <img src={firstImageURL} alt="" className="workflow-task-item-detail-image-value mb-1" />
            {imagesLen > 1 && (
              <span className="workflow-image-image-count mb-1">{'+'}{imagesLen}</span>
            )}
          </>
        );
      }
      case CellType.FILE: {
        if (!Array.isArray(value) || value.length === 0) return <span className="row-cell-value-empty"></span>;
        const filesLen = value.length;
        const firstFile = value[0];
        return (
          <>
            <img
              src={getFileIconUrl(mediaUrl, firstFile.name, firstFile.type)}
              alt=""
              className="workflow-task-item-detail-image-value mb-1"
            />
            {filesLen > 1 && (
              <span className="workflow-image-image-count mb-1">{'+'}{filesLen}</span>
            )}
          </>
        );
      }
      case CellType.LINK: {
        if (!Array.isArray(value) || value.length === 0) return <span className="row-cell-value-empty mt-2"></span>;
        return (
          value.map((item, index) => {
            return (
              <div className="workflow-task-item-detail-link-value" key={index}>
                <span className="link-name">{item.display_value}</span>
              </div>
            );
          })
        );
      }
      case CellType.DIGITAL_SIGN: {
        if (!value) return <span className="row-cell-value-empty"/>;
        const { workflowTask } = this.props;
        const { dtable_workflow, workspace_id: workspaceID } = workflowTask;
        const dtableUuid = dtable_workflow.dtable_uuid;
        const url = DigitalSignUtils.parseUrlFromSign(value);
        const signThumbnailUrl = DigitalSignUtils.concatToThumbnailUrl(url, { workspaceID, dtableUuid });
        const signImageUrl = transferAssetURL(signThumbnailUrl, workflowTask.dtable_workflow.token, workflowTask.id, column_key, CellType.DIGITAL_SIGN);
        return (
          <img src={signImageUrl} alt={gettext('Digital signature')} className="workflow-task-item-detail-image-value mb-1" />
        );
      }
      default: {
        if (!value) return <span className="row-cell-value-empty"></span>;
        return value ? value + '' : '';
      }
    }
  };

  renderAssignee = (participants) => {
    if (participants.length === 0) return <span className="row-cell-value-empty"></span>;
    return participants.map((item, index) => {
      const { avatar_url, name } = item;
      return (
        <div className="workflow-task-item-initiator mr-1" key={index}>
          <img src={avatar_url} className="initiator-avatar mr-1" alt={gettext('Avatar')} />
          <span className="text-truncate">{name}</span>
        </div>
      );
    });
  };

  renderHeaderItemToolTip = (target, tipValue) => {
    return (
      <UncontrolledTooltip
        target={target}
        delay={{ show: 0, hide: 0 }}
        placement="bottom"
        fade={false}
      >
        {tipValue}
      </UncontrolledTooltip>
    );
  };

  renderItemHeader = () => {
    const { workflowTask, canToggleMore } = this.props;
    const { initiator_name, created_at, updated_at, initiator_avatar_url, dtable_workflow: workflow, is_valid, state, id } = workflowTask;
    const workflowConfig = JSON.parse(workflow.workflow_config);
    const { workflow_name } = workflowConfig;
    return (
      <div className="workflow-task-item-header d-flex align-items-center">
        <div className="d-flex align-items-center">
          <span className="workflow-name text-truncate ml-4" title={workflow_name}>{workflow_name}</span>
          <div className="workflow-task-item-initiator ml-4" id={`workflow-task-item-header-initiator-${id}`}>
            <img src={initiator_avatar_url} className="initiator-avatar mr-1" alt={gettext('Avatar')} />
            <span className="text-truncate">{initiator_name}</span>
            {this.renderHeaderItemToolTip(`workflow-task-item-header-initiator-${id}`, gettext('Creator'))}
          </div>
          <div className="workflow-task-item-state ml-4">
            {is_valid && state && this.renderOption(state)}
            {!is_valid && gettext('Invalid')}
            {is_valid && state && this.renderHeaderItemToolTip(`workflow-task-item-header-state-${id}`, gettext('Current node'))}
          </div>
          <div className="workflow-task-item-create-time d-flex ml-4">
            <span className="">{`${gettext('Create time')}:`}</span>
            <span className="workflow-task-item-time ml-1" id={`workflow-task-item-header-create-time-${id}`}>
              {dayjs(created_at).format('YYYY-MM-DD HH:mm')}
            </span>
          </div>
          {updated_at && (
            <div className="workflow-task-item-update-time d-flex ml-4">
              <span className="">{`${gettext('Update time')}:`}</span>
              <span className="workflow-task-item-time ml-1" id={`workflow-task-item-header-create-time-${id}`}>
                {dayjs(updated_at).format('YYYY-MM-DD HH:mm')}
              </span>
            </div>
          )}
        </div>
        {canToggleMore && (
          <div className="workflow-item-more mr-4" onClick={this.toggleTaskMoreOperation}>
            <i
              className="dtable-font dtable-icon-more-level"
              id={`workflow-task-${workflowTask.id}`}
              title={gettext('More operations')}
              aria-label={gettext('More operations')}
            />
          </div>
        )}
      </div>
    );
  };

  render() {
    const { workflowTask, isAdmin, canManageParticipants, canCancelTask } = this.props;
    const { isMoreOperationPopoverShow, isManageParticipantsShow, isCancelTaskDialogShow,
      isResubmitTaskDialogShow, isDeleteTaskDialogShow } = this.state;
    const { submitted_values, is_valid, participants = [], node_id, current_node = {} } = workflowTask;
    const { node_form = {} } = current_node;
    const { readonly_columns = [], readwrite_columns = [] } = node_form;
    const visibleColumnKeys = [...readonly_columns, ...readwrite_columns].map(column => column.key);
    return (
      <div className="workflow-task-item" onClick={this.onClickTask}>
        {this.renderItemHeader()}
        <div className="workflow-task-item-container d-flex">
          <div className="workflow-task-item-content d-flex">
            <div className="container-item content-item-assignee mr-4">
              <span className="container-item-header">{gettext('Assignee')}</span>
              <div className="mt-4 assignee-content">
                {is_valid && this.renderAssignee(participants)}
                {!is_valid && gettext('Invalid')}
              </div>
            </div>
            {submitted_values.map((value, index) => {
              const { column_name, column_type, column_key } = value;
              if (!visibleColumnKeys.includes(column_key)) return null;
              return (
                <div className="container-item workflow-task-item-detail" key={index}>
                  <span className="container-item-header">{column_name}</span>
                  <div className={`mt-4 workflow-task-item-detail-value-display workflow-task-item-detail-${column_type}-value-display`}>
                    {is_valid && this.renderValue(value)}
                    {!is_valid && gettext('Invalid')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {isMoreOperationPopoverShow &&
          <WorkflowTaskItemPopover
            canCancelTask={canCancelTask && this.forbiddenCancelStates.indexOf(workflowTask.task_state) === -1}
            canResubmitTask={node_id === 'canceled'}
            canManageParticipants={canManageParticipants && workflowTask.current_node && workflowTask.current_node.type !== NODE_TYPE.INIT}
            isAdmin={isAdmin}
            target={`workflow-task-${workflowTask.id}`}
            onToggle={this.toggleTaskMoreOperation}
            toggleManageParticipants={this.toggleManageParticipants}
            toggleCancelTask={this.toggleCancelTask}
            toggleDeleteTask={this.toggleDeleteTask}
            toggleResubmitTask={this.toggleResubmitTask}
          />
        }
        {canManageParticipants && isManageParticipantsShow &&
          <ManageTaskParticipantsDialog
            workflowTask={workflowTask}
            onUpdateParticipants={this.onUpdateParticipants}
            toggle={this.toggleManageParticipants}
          />
        }
        {isCancelTaskDialogShow && (
          <CancelTaskDialog
            onToggle={this.toggleCancelTask}
            onSubmit={this.onCancelTask}
          />
        )}
        {isDeleteTaskDialogShow && (
          <DeleteTaskDialog
            onToggle={this.toggleDeleteTask}
            onSubmit={this.onDeleteWorkflowTask}
          />
        )}
        {isResubmitTaskDialogShow && (
          <ResubmitTaskDialog
            onToggle={this.toggleResubmitTask}
            onSubmit={this.onResubmitTask}
          />
        )}
      </div>
    );
  }
}

WorkflowTaskItem.defaultProps = {
  canToggleMore: false,
  isAdmin: false,
  canManageParticipants: false
};

WorkflowTaskItem.propTypes = {
  canManageParticipants: PropTypes.bool,
  canToggleMore: PropTypes.bool,
  isAdmin: PropTypes.bool,
  canCancelTask: PropTypes.bool,
  workflowTask: PropTypes.object,
  openWorkflowTask: PropTypes.func,
  onDeleteWorkflowTask: PropTypes.func,
  onUpdateParticipants: PropTypes.func,
  onCancelTask: PropTypes.func,
  onResubmitTask: PropTypes.func,
};

export default WorkflowTaskItem;
