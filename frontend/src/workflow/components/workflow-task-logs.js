import React from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { toaster } from 'dtable-ui-component';
import { gettext } from '../../utils/constants';
import { dtableWebAPI } from '../../api/dtable-web-api';
import Loading from '../../components/loading';
import { Utils } from '../../utils/utils';

const itemPropTypes = {
  taskLogItem: PropTypes.object
};

class WorkflowTaskLogItem extends React.Component {
  constructor(props) {
    super(props);
  }

  formatAction = (logType) => {
    switch (logType) {
      case 'init':
        return gettext('Initiated');
      case 'transfer':
        return gettext('Submit');
      case 'counter':
        return gettext('Submit');
      default:
        return logType;
    }
  };

  formatDuration = (duration) => {
    if (!duration) return '-';
    const mins = parseInt(duration / 60);
    const secs = parseInt(duration % 60);
    return `${mins} ${gettext('min(s)')} ${secs} ${gettext('sec(s)')}`;
  };

  render() {
    const { taskLogItem } = this.props;
    const isInit = taskLogItem.log_type === 'init';
    const iconClass = isInit ? 'dtable-icon-right-slide' : 'dtable-icon-history';
    const title = taskLogItem.node ? taskLogItem.node.name : gettext('Unknown node');
    const handledAt = dayjs(taskLogItem.created_at).format('YYYY-MM-DD HH:mm');
    const startAt = taskLogItem.start_at ? dayjs(taskLogItem.start_at).format('YYYY-MM-DD HH:mm') : '-';
    const duration = this.formatDuration(taskLogItem.duration);
    const fromNodeName = taskLogItem.node ? taskLogItem.node.name : '';
    const toNodeName = taskLogItem.next_node ? taskLogItem.next_node.name : '';
    return (
      <div>
        <div className='workflow-task-log-item'>
          <div className='task-log-title'>
            <span className='log-title'>
              <span className={`dtable-font ${iconClass}`} style={{ marginRight: '5px', color: '#ED7109' }} />
              <span className='title' title={title}>{title}</span>
            </span>
            <span className='time'>{handledAt}</span>
          </div>
          <div className='task-log-content'>
            <div className='operator-avatar'>
              <img alt='' src={taskLogItem.operator_avatar_url} />
            </div>
            <div className='log-pane'>
              <div className='workflow-action'>
                <span className='name' title={taskLogItem.operator_name}>{taskLogItem.operator_name}</span>
                <span className='action'>{this.formatAction(taskLogItem.log_type)}</span>
              </div>
              <div className='transaction'>
                {(taskLogItem.log_type === 'init' || taskLogItem.log_type === 'transfer') && (
                  <>
                    <span className='node-name text-truncate'>{fromNodeName}</span>
                    <span style={{ marginLeft: '5px', marginRight: '5px' }}>{'->'}</span>
                    <span className='node-name text-truncate'>{toNodeName}</span>
                  </>
                )}
                {taskLogItem.log_type === 'counter' && (
                  <span className='node-name text-truncate'>{fromNodeName}</span>
                )}
              </div>
              <div className='log-start-time'>{`${gettext('Start at')}: ${startAt}`}</div>
              {!isInit && <div className='log-duration'>{`${gettext('Duration')}: ${duration}`}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

WorkflowTaskLogItem.propTypes = itemPropTypes;

const propTypes = {
  workflowToken: PropTypes.string,
  taskId: PropTypes.number
};

class WorkflowTaskLogs extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      taskLogList: [],
      isLoading: true,
      isFinished: false,
      finishedAt: null,
      nextPage: 1
    };
    this.taskLogsContainer = null;
    this.taskLogsContent = null;
    this.hasNextPage = true;
  }

  componentDidMount() {
    this.loadLogs();
  }

  loadLogs = () => {
    if (!this.hasNextPage) return;
    const { workflowToken, taskId } = this.props;
    let { taskLogList, nextPage } = this.state;
    dtableWebAPI.listWorkflowTaskLogs(workflowToken, taskId, nextPage).then(res => {
      let newTaskLogList = taskLogList.slice();
      res.data.task_log_list.forEach(taskLog => {
        const exists = !!taskLogList.find(item => item.id === taskLog.id);
        if (!exists) {
          newTaskLogList.push(taskLog);
        }
      });
      if (res.data.task_log_list.length !== 0) {
        nextPage += 1;
      }
      this.setState({
        taskLogList: newTaskLogList,
        isLoading: false,
        isFinished: res.data.is_finished,
        finishedAt: res.data.finished_at,
        nextPage: nextPage
      });
      this.hasNextPage = res.data.has_next_page;
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  };

  loadMore = () => {
    if (this.state.isLoading) return;
    const scrollTop = this.taskLogsContent.scrollTop;
    const { height: containerHeight } = this.taskLogsContainer.getBoundingClientRect();
    if (this.taskLogsContent.scrollHeight - scrollTop - containerHeight > 2) return;
    this.loadLogs();
  };

  render() {
    const { taskLogList, isLoading, isFinished, finishedAt } = this.state;
    if (isLoading) {
      return (
        <div className='d-flex justify-content-center mt-8'>
          <Loading />
        </div>
      );
    }
    return (
      <div className='workflow-task-log-list' ref={ref => this.taskLogsContainer = ref}>
        <div
          className='log-list'
          ref={ref => this.taskLogsContent = ref}
          onScroll={this.loadMore}
        >
          {isFinished &&
            <div>
              <div className='workflow-task-log-item'>
                <div className='task-log-title'>
                  <span className='log-title'>
                    <span className='dtable-font dtable-icon-check-mark' style={{ marginRight: '5px', color: '#ED7109' }} />
                    <span className='title' title={gettext('Task finished')}>{gettext('Task finished')}</span>
                  </span>
                </div>
                <div className='task-log-content'>
                  <div className='task-finished'>
                    {`${gettext('Finished at')}: ${finishedAt ? dayjs(finishedAt).format('YYYY-MM-DD HH:mm') : '-'}`}
                  </div>
                </div>
              </div>
            </div>
          }
          {taskLogList.map(taskLog => {
            return (
              <WorkflowTaskLogItem
                key={taskLog.id}
                taskLogItem={taskLog}
              />
            );
          })}
        </div>
      </div>
    );
  }

}

WorkflowTaskLogs.propTypes = propTypes;

export default WorkflowTaskLogs;
