import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { gettext, siteRoot } from '../../utils/constants';
import { NOTIFICATION_TYPE } from '../../constants/notification-constants';

const propTypes = {
  noticeItem: PropTypes.object.isRequired,
  onOpenWorkflowTaskByNotification: PropTypes.func,
};

class NoticeItemDetail extends Component {

  onOpenWorkflowTaskByNotification = () => {
    const { noticeItem } = this.props;
    this.props.onOpenWorkflowTaskByNotification(noticeItem);
  };

  renderItemDetail = () => {
    const { noticeItem } = this.props;
    const detail = noticeItem.detail;
    switch (noticeItem.type) {
      case NOTIFICATION_TYPE.SHARE_DTABLE_TO_USER: {
        const shareFrom = detail.share_from.share_from_user_name;
        const dtableName = detail.dtable.name;
        const dtableUrl = siteRoot + 'workspace/' + detail.dtable.workspace_id + '/dtable/' + dtableName + '/';
        const dtableLink = '<a href="' + dtableUrl + '" >' + dtableName + '</a>';
        let notice = gettext('{share_from} has shared a base named {dtable_link} to you.');
        notice = notice.replace('{share_from}', shareFrom);
        notice = notice.replace('{dtable_link}', dtableLink);
        return (
          <div dangerouslySetInnerHTML={{ __html: notice }}></div>
        );
      }
      case NOTIFICATION_TYPE.SUBMIT_FORM: {
        const { form, submit_user } = detail;
        const { form_name, name: dtableName, table_id, row_id, workspace_id } = form;
        const { submit_user_name } = submit_user;
        const dtableUrl = siteRoot + 'workspace/' + workspace_id + '/dtable/' + dtableName + '/?tid=' + table_id + '&row-id=' + row_id;
        const dtableLink = '<a href="' + dtableUrl + '" class="notification-detail-link">' + gettext('Details') + '</a>';
        let notice;
        if (!submit_user_name) {
          notice = gettext('Anonymous user has submitted form {formName}.');
          notice = notice.replace('{formName}', form_name);
        } else {
          notice = gettext('{submitUser} has submitted form {formName}.');
          notice = notice.replace('{submitUser}', submit_user_name).replace('{formName}', form_name);
        }
        notice = notice + ' ' + dtableLink;
        return (
          <div dangerouslySetInnerHTML={{ __html: notice }}></div>
        );
      }
      case NOTIFICATION_TYPE.ADD_USER_TO_GROUP: {
        const groupStaff = detail.group_staff_name;
        const userHref = siteRoot + 'profile/' + detail.group_staff_email + '/';
        const groupName = detail.group_name;
        const userLink = '<a href=' + userHref + '>' + groupStaff + '</a>';
        let notice = gettext('{user_link} has added you to {group}');
        notice = notice.replace('{user_link}', userLink);
        notice = notice.replace('{group}', groupName);
        return (
          <div dangerouslySetInnerHTML={{ __html: notice }}></div>
        );
      }
      case NOTIFICATION_TYPE.NEW_PENDING_WORKFLOW_TASK: {
        if (!detail || !detail.workflow_task || !detail.initiator) return null;
        const workflowName = detail.workflow_name;
        const notice = (
          <>
            {gettext('You have a new')}{' '}
            <Link to={siteRoot + 'workflows/'} onClick={this.onOpenWorkflowTaskByNotification}>
              {workflowName}
            </Link>
            {' '}{gettext('task to handle.')}
          </>
        );
        return (
          <div>{notice}</div>
        );
      }
      case NOTIFICATION_TYPE.FINISH_WORKFLOW_TASK: {
        if (!detail || !detail.workflow_task || !detail.initiator) return null;
        const workflowName = detail.workflow_name;
        let notice = gettext('{workflowName} task submitted by you is finished.');
        const finishTaskMessage = detail.finish_task_message || '';
        const taskLink = `<a href="${detail.workflow_task.submitted_url}">${workflowName}</a>`;
        notice = notice.replace('{workflowName}', taskLink);
        if (finishTaskMessage) {
          notice = `${notice}\n"${finishTaskMessage}"`;
        }
        return (
          <div className='notification-details' dangerouslySetInnerHTML={{ __html: notice }}></div>
        );
      }
      case NOTIFICATION_TYPE.DISMISS_WORKFLOW_TASK: {
        if (!detail || !detail.workflow_task || !detail.initiator) return null;
        const workflowName = detail.workflow_name;
        const notice = (
          <>
            {gettext('You have a')}{' '}
            <Link to={siteRoot + 'workflows/'} onClick={this.onOpenWorkflowTaskByNotification}>
              {workflowName}
            </Link>
            {' '}{gettext('task that was dismissed. Resubmission is required.')}
          </>
        );
        return (
          <div>{notice}</div>
        );
      }
      case NOTIFICATION_TYPE.WORKFLOW_PROCESSING_EXPIRED: {
        if (!detail || !detail.workflow_task || !detail.initiator) return null;
        const { workflow_name: workflowName, offset } = detail;
        const offsetNumber = parseInt(offset);
        let expireString;
        if (offsetNumber === 1) {
          expireString = '1 ' + (offset.slice(-1) === 'd' ? gettext('day') : gettext('hour'));
        } else {
          expireString = offsetNumber + ' ' + (offset.slice(-1) === 'd' ? gettext('days') : gettext('hours'));
        }
        const notice = (
          <>
            {gettext('You have a')}{' '}
            <Link to={siteRoot + 'workflows/'} onClick={this.onOpenWorkflowTaskByNotification}>
              {workflowName}
            </Link>
            {' '}{gettext('task unprocessed for more than {expireString}.').replace('{expireString}', expireString)}
          </>
        );
        return (
          <div>{notice}</div>
        );
      }
      case NOTIFICATION_TYPE.LICENSE_EXPIRING: {
        if (!detail || !detail.days) return null;
        const { days } = detail;
        const { mode } = detail;
        let days_str;
        if (days > 1) {
          days_str = `${days} days`;
        } else {
          days_str = `${days} day`;
        }
        let notice = '';
        if (mode === 'life-time'){
          notice = gettext('Your service period will end in {days}.').replace('{days}', days_str);
        } else {
          notice = gettext('Your license will expire in {days}.').replace('{days}', days_str);
        }
        return (
          <div>{notice}</div>
        );
      }
      case NOTIFICATION_TYPE.SAML_SSO_FAILED: {
        if (!detail || !detail.error_msg) return null;
        const { error_msg } = detail;
        const notice = gettext(error_msg);
        return (
          <div>{notice}</div>
        );
      }
      default: {
        return null;
      }
    }
  };

  render() {
    return this.renderItemDetail();
  }
}

NoticeItemDetail.propTypes = propTypes;

export default NoticeItemDetail;
