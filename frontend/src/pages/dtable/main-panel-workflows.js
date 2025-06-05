import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Utils } from '../../utils/utils';
import Loading from '../../components/loading';
import { gettext } from '../../utils/constants';
import { dtableWebAPI } from '../../api/dtable-web-api';
import NoWorkflow from './workflow/no-workflow';

import '../../css/dtable-workflow.css';


const ListWorkflowItemPropTypes = {
  workflowItem: PropTypes.object.isRequired,
};

class ListWorkflowItem extends React.Component {

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
    let { workflowItem } = this.props;
    let appConfig = JSON.parse(workflowItem.app_config);
    let { workflow_form_link, group_name } = workflowItem;
    return (
      <tr onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
        <td className="text-center"><i className="dtable-font dtable-icon-workflow dtable-icon-style"></i></td>
        <td>
          <div className="workflow-item-content">
            <a
              className="workflow-item-text"
              href={workflow_form_link}
              target="_blank"
              rel='noreferrer noopener'
            >
              {appConfig.app_name}
            </a>
          </div>
        </td>
        <td>
          <div className="workflow-item-group-name">{group_name}</div>
        </td>
      </tr>
    );
  }
}

ListWorkflowItem.propTypes = ListWorkflowItemPropTypes;


class MainPanelWorkflows extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      workflowList: [],
      errorMsg: '',
    };
  }

  componentDidMount() {
    dtableWebAPI.listSharedWorkflows().then(res => {
      this.setState({
        isLoading: false,
        workflowList: res.data.workflow_list,
      });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      this.setState({ errorMsg: errMessage, isLoading: false });
    });
  }

  render() {
    let { isLoading, workflowList } = this.state;
    if (isLoading) return <Loading />;
    if (workflowList.length === 0) return (
      <NoWorkflow
        title={gettext('No workflows yet')}
        description={gettext('No workflows yet.')}
      />
    );
    let isDesktop = Utils.isDesktop();
    return (
      <div className="main-panel-center">
        <div className="cur-view-container" id="forms">
          <div className="cur-view-content d-block" onScroll={this.handleScroll}>
            <div className="workflow-title">{gettext('Workflow')}</div>
            {this.state.errorMsg &&
              <p className="error text-center">{this.state.errorMsg}</p>
            }
            {!this.state.errorMsg &&
              <table className="table-hover activity-table">
                <thead>
                  <tr>
                    <th width={isDesktop ? '5%' : '10%'}></th>
                    <th width={isDesktop ? '70%' : '65%'}>{gettext('Name')}</th>
                    <th width={isDesktop ? '25%' : '25%'}>{gettext('Group')}</th>
                  </tr>
                </thead>
                <tbody>
                  {workflowList.map((workflowItem, index) => {
                    return (
                      <ListWorkflowItem
                        key={index}
                        workflowItem={workflowItem}
                      />);
                  })}
                </tbody>
              </table>
            }
          </div>
        </div>
      </div>
    );
  }
}

export default MainPanelWorkflows;
