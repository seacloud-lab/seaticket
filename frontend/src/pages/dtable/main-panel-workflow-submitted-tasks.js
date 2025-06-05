import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Utils } from '../../utils/utils';
import Loading from '../../components/loading';
import { gettext } from '../../utils/constants';
import { dtableWebAPI } from '../../api/dtable-web-api';
import Paginator from '../../components/paginator';
import NoWorkflow from './workflow/no-workflow';

import '../../css/dtable-workflow.css';


const TaskItemPropTypes = {
  workflowTaskItem: PropTypes.object.isRequired,
};

class TaskItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isActive: false,
    };
  }

  onMouseEnter = () => {
    this.setState({ isActive: true });
  };

  onMouseLeave = () => {
    this.setState({ isActive: false });
  };

  render() {
    let { workflowTaskItem } = this.props;
    let appConfig = JSON.parse(workflowTaskItem.dtable_workflow.app_config);
    let workflowName = appConfig.app_name;
    let itemLink = workflowTaskItem.submitted_url;
    return (
      <tr onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
        <td className="text-center"><i className="dtable-font dtable-icon-workflow dtable-icon-style"></i></td>
        <td>
          <div className="workflow-item-content">
            <a className="workflow-item-text" href={itemLink} target="_blank" rel='noreferrer noopener'>{workflowName}</a>
          </div>
        </td>
        <td>
          <div className="workflow-item-group-name">{workflowTaskItem.initiator_name}</div>
        </td>
        <td>
          <div className="workflow-item-text">{workflowTaskItem.state}</div>
        </td>
      </tr>
    );
  }
}

TaskItem.propTypes = TaskItemPropTypes;


class MainPanelWorkflowSubmittedTasks extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      taskList: [],
      errorMsg: '',
      page: 1,
      perPage: 25,
      hasNextPage: false
    };
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { page, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      page: parseInt(urlParams.get('page') || page)
    }, () => {
      this.loadData(this.state.page);
    });
  };

  loadData = (page) => {
    let { perPage } = this.state;
    dtableWebAPI.listSubmittedWorkflowTasks(page, perPage).then(res => {
      this.setState({
        isLoading: false,
        taskList: res.data.task_list,
        page: page,
        hasNextPage: Utils.hasNextPage(page, perPage, res.data.count)
      });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      this.setState({ errorMsg: errMessage, isLoading: false });
    });
  };

  getPreviousPageList = () => {
    this.setState({ page: this.state.page - 1}, () => {
      this.loadData(this.state.page);
    });
  };

  getNextPageList = () => {
    this.setState({ page: this.state.page + 1}, () => {
      this.loadData(this.state.page);
    });
  };

  resetPerPage = (perPage) => {
    this.setState({
      page: 1,
      perPage: perPage
    }, () => {
      this.loadData(this.state.page);
    });
  };

  render() {
    let { isLoading, taskList } = this.state;
    if (isLoading) return <Loading />;
    if (taskList.length === 0) return (
      <NoWorkflow
        title={gettext('No workflow tasks yet')}
        description={gettext('Workflow tasks you submitted will be shown here.')}
      />
    );
    let isDesktop = Utils.isDesktop();
    return (
      <div className="main-panel-center">
        <div className="cur-view-container" id="forms">
          <div className="cur-view-content d-block" onScroll={this.handleScroll}>
            <div className="workflow-title">{gettext('My submitted tasks')}</div>
            {this.state.errorMsg &&
              <p className="error text-center">{this.state.errorMsg}</p>
            }
            {!this.state.errorMsg &&
              <Fragment>
                <table className="table-hover activity-table">
                  <thead>
                    <tr>
                      <th width={isDesktop ? '5%' : '10%'}></th>
                      <th width={isDesktop ? '40%' : '40%'}>{gettext('Workflow')}</th>
                      <th width={isDesktop ? '45%' : '40%'}>{gettext('Creator')}</th>
                      <th width={isDesktop ? '10%' : '10%'}>{gettext('State')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taskList.map(task => {
                      return (
                        <TaskItem
                          key={task.id}
                          workflowTaskItem={task}
                        />
                      );
                    })}
                  </tbody>
                </table>
                <Paginator
                  gotoPreviousPage={this.getPreviousPageList}
                  gotoNextPage={this.getNextPageList}
                  currentPage={this.state.page}
                  hasNextPage={this.state.hasNextPage}
                  curPerPage={this.state.perPage}
                  resetPerPage={this.resetPerPage}
                />
              </Fragment>
            }
          </div>
        </div>
      </div>
    );
  }
}

export default MainPanelWorkflowSubmittedTasks;
