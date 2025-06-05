import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalHeader, ModalBody, UncontrolledTooltip } from 'reactstrap';
import copy from 'copy-to-clipboard';
import { toaster } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import UserService from '../../../utils/user-service';
import WorkflowRowItem from '../common/workflow-row-item';
import Loading from '../../../components/loading';
import WorkflowChart from '../workflow-chart';
import { Utils, DIALOG_MAX_HEIGHT } from '../../../utils/utils';
import WorkflowTaskLogs from '../workflow-task-logs';
import { getValidWorkflowColumns, getDisplayNodeColumns, getWorkflowFilteredColumns } from '../../utils/utils';
import WorkflowTaskHeaderRightBtn from './widgets/workflow-task-header-right-btn';

import '../../css/dialog/workflow-task-pending-dialog.css';

const gettext = window.gettext;
const { mediaUrl } = window.app.config;
const { server } = window.app.pageOptions;

class WorkflowTaskAdminDialog extends Component {

  constructor(props) {
    super(props);
    this.initConfig(props);
    this.state = {
      isMoreInfoShow: false,
      isLoading: true,
      rowData: {},
      moreInfoType: 'flow-chart',
      collaborators: [],
      taskState: null
    };
    this.modalRef = React.createRef();
    this.focusDom = React.createRef();
    this.animationEnd = false;
    this.userService = new UserService();
  }

  componentDidMount() {
    this.startAnimation();
    const { workflowTask } = this.props;
    const { dtable_workflow } = workflowTask;
    const dtableUuid = dtable_workflow.dtable_uuid;
    dtableWebAPI.getWorkflowTaskAdminView(this.token, this.taskId).then(res => {
      const { table, tables, row, show_columns, nodes, current_node, workspace_id,
        dtable_name, columns_config, state: taskState } = res.data;
      this.table = table;
      this.tables = tables;
      this.nodes = nodes;
      this.currentNode = current_node;
      this.workspaceId = workspace_id;
      this.dtableName = dtable_name;
      this.editorConfig = {
        type: 'workflow',
        token: this.token,
        workspaceID: this.workspaceId,
        fileName: this.dtableName,
        dtableWebURL: server,
        mediaUrl,
        server,
        taskId: this.taskId,
        dtableUuid,
      };
      this.userService.getRelatedUsers(this.workspaceId, this.dtableName, { workflowToken: this.token, taskId: workflowTask.id }, this.updateCollaborators);
      this.workflowColumns = getValidWorkflowColumns(this.table.columns, columns_config, tables, table._id);
      const shownColumns = getDisplayNodeColumns(this.workflowColumns, show_columns);
      this.displayColumns = getWorkflowFilteredColumns(shownColumns, this.workflowColumns, row);
      this.setState({ taskState: taskState });
      if (!document.getElementById('seafile-editor-font')) {
        const linkEle = document.createElement('link');
        linkEle.href = '/media/css/seafile-editor-font.css';
        linkEle.rel = 'stylesheet';
        linkEle.id = 'seafile-editor-font';
        document.head.appendChild(linkEle);
      }
      this.setState({ rowData: { ...row }, isLoading: false });
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      this.setState({ isLoading: false });
    });
  }

  initConfig = (props) => {
    const { workflowTask } = props;
    const { dtable_workflow, id } = workflowTask;
    const { workflow_config, token } = dtable_workflow;
    const workflowConfig = JSON.parse(workflow_config);
    const { workflow_name: workflowName } = workflowConfig;
    this.taskId = id;
    this.token = token;
    this.workflowName = workflowName;
    this.table = {};
    this.tables = [];
    this.workflowColumns = [];
    this.displayColumns = [];
    this.nodes = [];
    this.currentNode = {};
    this.workspaceId = null;
    this.dtableName = null;
    this.editorConfig = {};
  };

  queryUsers = (emails) => {
    this.userService.queryUsers(emails, this.updateCollaborators);
  };

  updateCollaborators = (emailUserMap) => {
    let collaborators = [];
    for (let email in emailUserMap) {
      collaborators.push(emailUserMap[email]);
    }
    this.setState({ collaborators });
  };

  onToggle = () => {
    this.props.onToggle();
  };

  toggleMoreInfoShow = () => {
    this.setState({ isMoreInfoShow: !this.state.isMoreInfoShow }, () => {
      localStorage.setItem('isWorkflowMoreInfoShow', this.state.isMoreInfoShow);
    });
  };

  getDialogStyle = () => {
    let { isMoreInfoShow } = this.state;
    let width = isMoreInfoShow ? 1100 : 800;
    return {
      width,
      maxWidth: width,
      marginLeft: (window.innerWidth - width) / 2,
      height: DIALOG_MAX_HEIGHT,
    };
  };

  getInitStyle = () => {
    const transition = 'all .3s';
    const defaultMargin = 80; // sequence cell width
    const defaultHeight = 100;
    const width = window.innerWidth;
    return {
      width: `${width - defaultMargin}px`,
      maxWidth: `${width - defaultMargin}px`,
      marginLeft: `${defaultMargin}px`,
      height: `${defaultHeight}px`,
      marginRight: `${defaultMargin}px`,
      marginTop: '30%',
      transition,
    };
  };

  startAnimation = () => {
    // use setTimeout to make sure real dom rendered
    const that = this;
    setTimeout(() => {
      let dom = this.modalRef.current.firstChild;
      const { width, maxWidth, marginLeft, height } = this.getDialogStyle();
      dom.style.width = `${width}px`;
      dom.style.maxWidth = `${maxWidth}px`;
      dom.style.marginLeft = `${marginLeft}px`;
      dom.style.height = `${height}px`;
      dom.style.marginRight = 'unset';
      dom.style.marginTop = '28px';
      // after animation, change style and run callback
      setTimeout(() => {
        that.animationEnd = true;
        dom.style.transition = 'none';
        const isMoreInfoShow = localStorage.getItem('isWorkflowMoreInfoShow');
        that.setState({ isMoreInfoShow: isMoreInfoShow === 'false' ? false : true });
      }, 280);
    }, 1);
  };

  writeURLToClipboard = () => {
    const { workflowTask } = this.props;
    const { transfer_url } = workflowTask;
    copy(transfer_url);
    let message = gettext('Workflow task link copied');
    toaster.success(message);
  };

  renderWorkflowState = () => {
    const { workflowTask } = this.props;
    const { state } = workflowTask;
    const { name, color, textColor } = this.state.taskState || state || {};
    return (
      <span
        className="select-option workflow-task-state"
        style={{ color: textColor, backgroundColor: color }}
      >
        {name}
      </span>
    );
  };

  renderTaskDetails = () => {
    const { isLoading, rowData, collaborators } = this.state;
    if (isLoading) {
      return (
        <div className="workflow-task-pending-content" ref={ref => this.contentRef = ref}>
          <Loading />
        </div>
      );
    }
    return (
      <div className="workflow-task-pending-content" ref={ref => this.contentRef = ref}>
        {this.displayColumns.map(column => {
          if (!column.key) return null;
          return (
            <WorkflowRowItem
              key={column.key}
              column={column}
              table={this.table}
              tables={this.tables}
              workflowTaskId={this.props.workflowTask.id}
              row={rowData}
              value={rowData[column.key]}
              columns={this.displayColumns}
              isReadOnly={true}
              isSupportPreview={true}
              isShowDescriptionDirectly={false}
              editorConfig={this.editorConfig}
              onCommit={() => {}}
              canViewFile={true}
              collaborators={collaborators}
              queryUsers={this.queryUsers}
            />
          );
        })}
      </div>
    );
  };

  renderWorkflowNodes = () => {
    const { isLoading } = this.state;
    if (isLoading) {
      return (
        <div className="workflow-task-nodes-content" ref={ref => this.workflowNodesContentRef = ref}>
          <Loading />
        </div>
      );
    }

    return (
      <div className="workflow-task-nodes-content workflow-app-nodes-content" ref={ref => this.workflowNodesContentRef = ref}>
        <WorkflowChart
          readonly={true}
          selectedNode={this.currentNode}
          workflowRelatedUsers={[]}
          nodes={this.nodes}
        />
      </div>
    );
  };

  onChangeMoreInfoType = (moreInfoType) => {
    this.setState({ moreInfoType: moreInfoType });
  };

  render() {
    const { isMoreInfoShow, moreInfoType } = this.state;
    const headerRightBtn = (
      <WorkflowTaskHeaderRightBtn
        isMoreInfoShow={isMoreInfoShow}
        onToggle={this.toggleMoreInfoShow}
        onClose={this.onToggle}
      />
    );

    return (
      <Modal
        isOpen={true}
        autoFocus={true}
        fade={false}
        style={this.animationEnd ? this.getDialogStyle() : this.getInitStyle()}
        zIndex={101}
        className="workflow-task-pending-dialog"
        contentClassName="workflow-task-pending-content"
        innerRef={this.modalRef}
        toggle={this.onToggle}
      >
        {this.animationEnd && (
          <div className="workflow-task-pending-details">
            <ModalHeader
              className="workflow-task-pending-details-header"
              close={isMoreInfoShow ? null : headerRightBtn}
            >
              <div className="workflow-task-title">
                <span className="workflow-task-title-content text-truncate">{this.workflowName}</span>
                {this.renderWorkflowState()}
                <span className="workflow-task-pending-details-header-url-btn">
                  <span
                    id="workflow-task-initiated-url-btn"
                    onClick={this.writeURLToClipboard}
                    className="btn-icon btn-active workflow-task-url-btn"
                    data-placement="bottom"
                  >
                    <i className="dtable-font dtable-icon-url"></i>
                  </span>
                  <UncontrolledTooltip
                    target="workflow-task-initiated-url-btn"
                    delay={{ show: 0, hide: 0 }}
                    placement="bottom"
                    fade={false}
                  >
                    {gettext('Get URL')}
                  </UncontrolledTooltip>
                </span>
              </div>
            </ModalHeader>
            <ModalBody className="workflow-task-container">
              {this.renderTaskDetails()}
            </ModalBody>
          </div>
        )}
        {(isMoreInfoShow && this.animationEnd) && (
          <div className="workflow-task-flow">
            <ModalHeader close={headerRightBtn} className="workflow-task-flow-header">
              <span
                onClick={this.onChangeMoreInfoType.bind(this, 'flow-chart')}
                className={`side-operation ${moreInfoType === 'flow-chart' ? 'flow-chart' : ''}`}
              >
                {gettext('Flow chart')}
              </span>
              <span
                onClick={this.onChangeMoreInfoType.bind(this, 'task-logs')}
                className={`side-operation ${moreInfoType === 'task-logs' ? 'task-logs' : ''}`}
              >
                {gettext('Task logs')}
              </span>
            </ModalHeader>
            <ModalBody className="workflow-task-flow-body">
              {moreInfoType === 'flow-chart' && this.renderWorkflowNodes()}
              {moreInfoType === 'task-logs' &&
                <WorkflowTaskLogs
                  workflowToken={this.token}
                  taskId={this.taskId}
                />
              }
            </ModalBody>
          </div>
        )}
      </Modal>
    );
  }
}

WorkflowTaskAdminDialog.propTypes = {
  workflowTask: PropTypes.object.isRequired,
  onToggle: PropTypes.func.isRequired,
};

export default WorkflowTaskAdminDialog;
