import React, { Component } from 'react';
import { Dropdown, DropdownItem } from 'reactstrap';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import {
  CellType,
  getNumberDisplayString,
  getDateDisplayString,
  getGeolocationDisplayString,
  getDurationDisplayString,
} from 'dtable-utils';
import { getPreviewContent } from '@seafile/seafile-editor';
import ModalPortal from '../../../components/modal-portal';
import WorkflowTaskDetailView from './workflow-task-detail-view';
import { gettext, mediaUrl } from '../../../utils/constants';
import { getFileIconUrl } from '../../../components-form/utils/utils';
import DeleteTaskDialog from '../dialog/delete-task-dialog';
import CancelTaskDialog from '../dialog/cancel-task-dialog';
import ResubmitTaskDialog from '../dialog/resubmit-task-dialog';
import Icon from '../../../components/icon';
import DigitalSignUtils from '../../../components-form/cell-editor-widgets/digital-sign-editor/digital-sign-utils';
import { transferAssetURL } from '../../utils/asset';

class WorkflowTaskItemCard extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isSettingsViewShow: false,
      isTaskDetailViewShow: false,
      isDeleteTaskDialogShow: false,
      isCancelTaskDialogShow: false,
      isResubmitTaskDialogShow: false,
    };
  }

  toggleSettingsView = (e) => {
    e && e.stopPropagation();
    this.setState({ isSettingsViewShow: !this.state.isSettingsViewShow });
  };

  toggleTaskDetailView = () => {
    this.setState({
      isTaskDetailViewShow: !this.state.isTaskDetailViewShow
    });
  };

  toggleDeleteTask = () => {
    this.setState({ isDeleteTaskDialogShow: !this.state.isDeleteTaskDialogShow });
  };

  toggleCancelTask = () => {
    this.setState({ isCancelTaskDialogShow: !this.state.isCancelTaskDialogShow });
  };

  toggleResubmitTask = () => {
    this.setState({ isResubmitTaskDialogShow: !this.state.isResubmitTaskDialogShow });
  };

  onDeleteWorkflowTask = () => {
    const { workflowTask } = this.props;
    this.props.onDeleteWorkflowTask(workflowTask.id);
  };

  onCancelWorkflowTask = () => {
    const { workflowTask } = this.props;
    this.props.onCancelWorkflowTask(workflowTask.id);
  };

  onResubmitWorkflowTask = () => {
    const { workflowTask } = this.props;
    this.props.onResubmitWorkflowTask(workflowTask.id);
  };

  renderValue = (submittedValue) => {
    const { workflowTask } = this.props;
    const { column_key, column_type, column_data, value } = submittedValue;
    switch (column_type) {
      case CellType.SINGLE_SELECT: {
        if (!value) return null;
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
        if (!value) return null;
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
        if (!Array.isArray(value) || value.length === 0) return null;
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
          <input type='checkbox' checked={value ? 'checked' : ''} disabled={true} />
        );
      }
      case CellType.DATE: {
        const { format } = column_data || {};
        return getDateDisplayString(value, format);
      }
      case CellType.GEOLOCATION: {
        return getGeolocationDisplayString(value, column_data, { hyphen: ' ' });
      }
      case CellType.NUMBER: {
        return getNumberDisplayString(value, column_data || {});
      }
      case CellType.DURATION: {
        return getDurationDisplayString(value, column_data || {});
      }
      case CellType.RATE: {
        if (!value) return null;
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
        if (!value) return null;
        let validValue = value;
        if (typeof value === 'string') {
          validValue = getPreviewContent(value);
        }
        if (!validValue) return null;
        const { previewText, images, links } = validValue;
        const linksLen = links ? links.length : 0;
        const imagesLen = images ? images.length : 0;
        let firstImageSrc;
        if (imagesLen > 0) {
          firstImageSrc = transferAssetURL(images[0], workflowTask.dtable_workflow.token, workflowTask.id, column_key, column_type);
        }
        return (
          <div className="view-content-item-longtext">
            {linksLen > 0 && (
              <div className="workflow-longtext-icon-container workflow-longtext-links-container">
                <i className="dtable-font dtable-icon-url"></i>{links.length}
              </div>
            )}
            {imagesLen > 0 && (
              <div className="workflow-longtext-icon-container workflow-longtext-images-container">
                <img src={firstImageSrc} alt="" className="workflow-longtext-image" />
                {imagesLen > 1 && (
                  <i className="workflow-longtext-image-count">{'+'}{imagesLen}</i>
                )}
              </div>
            )}
            {<div className="workflow-longtext-preview-text text-truncate">{previewText}</div>}
          </div>
        );
      }
      case CellType.IMAGE: {
        if (!Array.isArray(value) || value.length === 0) return null;
        const imagesLen = value.length;
        let firstImageSrc = transferAssetURL(value[0], workflowTask.dtable_workflow.token, workflowTask.id, column_key, column_type);
        return (
          <>
            <img src={firstImageSrc} alt="" className="workflow-task-item-detail-image-value" />
            {imagesLen > 1 && (
              <span className="workflow-image-image-count">{'+'}{imagesLen}</span>
            )}
          </>
        );
      }
      case CellType.FILE: {
        if (!Array.isArray(value) || value.length === 0) return null;
        const filesLen = value.length;
        const firstFile = value[0];
        return (
          <>
            <img
              src={getFileIconUrl(mediaUrl, firstFile.name, firstFile.type)}
              alt=""
              className="workflow-task-item-detail-image-value"
            />
            {filesLen > 1 && (
              <span className="workflow-image-image-count">{'+'}{filesLen}</span>
            )}
          </>
        );
      }
      case CellType.LINK: {
        if (!Array.isArray(value) || value.length === 0) return null;
        return (
          <div className="workflow-task-item-detail-text-value-display">
            {
              value.map((item, index) => {
                return (
                  <div className="workflow-task-item-detail-link-value" key={index}>
                    <span className="link-name">{item.display_value}</span>
                  </div>
                );
              })
            }
          </div>
        );
      }
      case CellType.DIGITAL_SIGN: {
        if (!value) return null;
        const { dtable_workflow, workspace_id: workspaceID } = workflowTask;
        const dtableUuid = dtable_workflow.dtable_uuid;
        const url = DigitalSignUtils.parseUrlFromSign(value);
        let signThumbnailUrl = DigitalSignUtils.concatToThumbnailUrl(url, { workspaceID, dtableUuid });
        signThumbnailUrl = transferAssetURL(signThumbnailUrl, dtable_workflow.token, workflowTask.id, column_key, column_type);
        return (
          <img src={signThumbnailUrl} alt={gettext('Digital signature')} className="workflow-task-item-detail-image-value" />
        );
      }
      default: {
        return value ? value + '' : '';
      }
    }
  };

  renderSettingsMore = () => {
    const { isAdmin, canCancelTask, canResubmitTask } = this.props;

    return (
      <ModalPortal>
        <div onClick={this.toggleSettingsView}>
          <div className="mobile-operation-menu-bg-layer"></div>
          <div className="mobile-operation-menu">
            <Dropdown
              isOpen={this.state.isSettingsViewShow}
              toggle={() => {}}
              style={{ width: '100%' }}
            >
              {isAdmin &&
                <DropdownItem onClick={this.toggleDeleteTask} className="mobile-dropdown-item">
                  <span className="dtable-font dtable-icon-delete"></span>
                  <span className="mobile-dropdown-span">{gettext('Delete task')}</span>
                </DropdownItem>
              }
              {canCancelTask &&
                <DropdownItem onClick={this.toggleCancelTask} className="mobile-dropdown-item">
                  <Icon symbol="cancel-task" className="dtable-font workflow-item-operation-icon" />
                  <span className="mobile-dropdown-span">{gettext('Cancel task')}</span>
                </DropdownItem>
              }
              {canResubmitTask && (
                <DropdownItem onClick={this.toggleResubmitTask} className="mobile-dropdown-item">
                  <Icon symbol="resubmit-task" className="dtable-font workflow-item-operation-icon" />
                  <span className="mobile-dropdown-span">{gettext('Resubmit task')}</span>
                </DropdownItem>
              )}
            </Dropdown>
          </div>
        </div>
      </ModalPortal>
    );
  };

  renderTaskDetail = () => {
    const { currentTag } = this.props;
    return (
      <ModalPortal>
        <WorkflowTaskDetailView
          isSpecificWorkflow={this.props.isSpecificWorkflow}
          toggle={this.toggleTaskDetailView}
          workflowTask={this.props.workflowTask}
          currentTag={currentTag}
          reloadFirstPageWorkflowTasks={this.props.reloadFirstPageWorkflowTasks}
        />
      </ModalPortal>
    );
  };

  render() {
    const { workflowTask, isSpecificWorkflow, canToggleMore, workflowName } = this.props;
    const { isDeleteTaskDialogShow, isCancelTaskDialogShow, isResubmitTaskDialogShow } = this.state;
    const { initiator_name, state, submitted_values, created_at, initiator_avatar_url, is_valid, participants = [] } = workflowTask;
    return (
      <div className="list-item-card" onClick={this.toggleTaskDetailView}>
        <h5>{workflowName}</h5>
        {isSpecificWorkflow && canToggleMore && (
          <div className="list-item-card-more" onClick={this.toggleSettingsView}>
            <i
              className="dtable-font dtable-icon-more-level"
              title={gettext('More operations')}
              aria-label={gettext('More operations')}
            >
            </i>
          </div>
        )}
        <div className="list-item-card-content">
          <div className="content-item">
            <span>{gettext('Creator')}</span>
            <div className="collaborator ml-4">
              <span className="collaborator-avatar-container">
                <img className="collaborator-avatar" alt={initiator_name} src={initiator_avatar_url}/>
              </span>
              <span className="collaborator-name" title={initiator_name} aria-label={initiator_name}>{initiator_name}</span>
            </div>
          </div>
          {is_valid && state && (
            <div className="content-item">
              <span>{gettext('Current node')}</span>
              <div className="current-node ml-4">
                <span
                  className="current-node-option"
                  style={{ color: state.textColor, backgroundColor: state.color }}
                >
                  {state.name}
                </span>
              </div>
            </div>
          )}
          <div className="content-item text-truncate d-block">
            <span>{gettext('Assignee')}</span>
            <span className="ml-4">{participants.map(item => item.name).join(', ')}</span>
          </div>
          {is_valid && submitted_values.slice(0, 3).map((submittedValue) => {
            const { column_name, column_type } = submittedValue;
            return (
              <div key={column_name} className="content-item">
                <span>{column_name}</span>
                <div className={`workflow-task-item-detail-value-display workflow-task-item-detail-${column_type}-value-display ml-4`}>
                  {this.renderValue(submittedValue)}
                </div>
              </div>
            );
          })}
          <div className="content-item">
            <span>{gettext('Updated at')}</span>
            <span className="ml-4">{dayjs(created_at).format('YYYY-MM-DD HH:mm')}</span>
          </div>
        </div>
        {this.state.isSettingsViewShow && this.renderSettingsMore()}
        {this.state.isTaskDetailViewShow && this.renderTaskDetail()}
        {isDeleteTaskDialogShow &&
          <DeleteTaskDialog
            onToggle={this.toggleDeleteTask}
            onSubmit={this.onDeleteWorkflowTask}
          />
        }
        {isCancelTaskDialogShow &&
          <CancelTaskDialog
            onToggle={this.toggleCancelTask}
            onSubmit={this.onCancelWorkflowTask}
          />
        }
        {isResubmitTaskDialogShow &&
          <ResubmitTaskDialog
            onToggle={this.toggleResubmitTask}
            onSubmit={this.onResubmitWorkflowTask}
          />
        }
      </div>
    );
  }
}

WorkflowTaskItemCard.propTypes = {
  isSpecificWorkflow: PropTypes.bool,
  isAdmin: PropTypes.bool,
  canCancelTask: PropTypes.bool,
  canToggleMore: PropTypes.bool,
  canResubmitTask: PropTypes.bool,
  workflowName: PropTypes.string,
  workflowTask: PropTypes.object,
  currentTag: PropTypes.string,
  onCancelWorkflowTask: PropTypes.func,
  onDeleteWorkflowTask: PropTypes.func,
  onResubmitWorkflowTask: PropTypes.func,
  reloadFirstPageWorkflowTasks: PropTypes.func,
};

export default WorkflowTaskItemCard;
