import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { getShowColumns } from '../../utils/utils';
import html5DragDropContext from '../../../utils/html5DragDropContext';
import PaneDivider from './pane-divider';
import ReadWriteColumnsContainer from './read-write-columns-container';
import ReadOnlyColumnsContainer from './read-only-columns-container';
import eventBus from '../../../utils/event-bus';
import { EVENT_OPERATION_TYPE } from '../../../constants/event-operation-type';
import { Utils } from '../../../utils/utils';

const gettext = window.gettext;

class WorkflowNodeColumnsEdit extends React.Component {

  static contextTypes = {
    dragDropManager: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      editingColumnIdx: -1,
    };
  }

  componentDidMount() {
    const { dragDropManager } = this.context;
    const workflowWidth = localStorage.getItem('workflow_width');
    if (this.workflowNodesRef && workflowWidth) {
      this.workflowNodesRef.style.width = workflowWidth + 'px';
    }
    document.addEventListener('dragover', this.handleDragOver);
    this.clearMonitorSubscription = dragDropManager.getMonitor().subscribeToStateChange(() => this.handleMonitorChange());
    this.unselectFormFieldEvent = eventBus.subscribe(EVENT_OPERATION_TYPE.UNSELECT_WORKFLOW_FORM_FIELD, this.cancelEditingColumn);
  }

  componentWillUnmount() {
    document.removeEventListener('dragover', this.handleDragOver);
    this.clearMonitorSubscription();
    this.unselectFormFieldEvent();
  }

  handleMonitorChange = () => {
    const { dragDropManager } = this.context;
    const isDragging = dragDropManager.getMonitor().isDragging();

    if (!isDragging && this.scrollTimer) {
      clearInterval(this.scrollTimer);
    }
  };

  handleDragOver = (event) => {
    const { dragDropManager } = this.context;
    const isDragging = dragDropManager.getMonitor().isDragging();
    if (!isDragging) return;
    const { clientY } = event;
    const bottomDistance = this.appContentContainerRef.offsetHeight - clientY;
    if (clientY <= 150) {
      Utils.debounce(this.scrollUp());
    } else if (bottomDistance <= 30) {
      Utils.debounce(this.scrollDown());
    } else {
      if (this.scrollTimer) clearInterval(this.scrollTimer);
    }
  };

  scrollUp = () => {
    clearInterval(this.scrollTimer);
    this.scrollTimer = setInterval(() => {
      this.appContentContainerRef.scrollTop = this.appContentContainerRef.scrollTop - 3;
      if (this.appContentContainerRef.scrollTop <= 0) {
        clearInterval(this.scrollTimer);
      }
    }, 5);
  };

  scrollDown = () => {
    clearInterval(this.scrollTimer);
    this.scrollTimer = setInterval(() => {
      this.appContentContainerRef.scrollTop = this.appContentContainerRef.scrollTop + 3;
      if (this.appContentContainerRef.clientHeight + this.appContentContainerRef.scrollTop >= this.appContentContainerRef.scrollHeight) {
        clearInterval(this.scrollTimer);
      }
    }, 5);
  };

  setEditingColumnIdx = (columnIdx) => {
    this.setState({ editingColumnIdx: columnIdx }, () => {
      eventBus.dispatch(EVENT_OPERATION_TYPE.SELECT_WORKFLOW_FORM_FIELD, columnIdx);
    });
  };

  cancelEditingColumn = (event) => {
    if (event && event.target.className !== 'app-content-container') return;
    this.setState({ editingColumnIdx: -1 });
  };

  onColumnChanged = (column_key, update = {}) => {
    const { workflowConfig } = this.props;
    const { columns_config } = workflowConfig;
    const columnsConfig = columns_config || {};
    let newColumnsConfig = { ...columnsConfig };
    const column = newColumnsConfig[column_key] || {};
    const newColumn = { ...column, ...update };
    newColumnsConfig[column_key] = newColumn;
    const newWorkflowConfig = { ...workflowConfig, columns_config: newColumnsConfig };
    this.props.updateWorkflowConfig(newWorkflowConfig);
  };

  getRowItems = (allColumns, readWriteColumns, readOnlyColumns) => {
    const { editingColumnIdx } = this.state;
    const { editorConfig, workflowConfig, selectedNode } = this.props;
    return (
      <>
        {Array.isArray(readOnlyColumns) && readOnlyColumns.length > 0 && (
          <ReadOnlyColumnsContainer
            readOnlyColumns={readOnlyColumns}
            editorConfig={editorConfig}
            workflowConfig={workflowConfig}
            selectedNode={selectedNode}
            currentColumns={allColumns}
            updateWorkflowConfig={this.props.updateWorkflowConfig}
          />
        )}
        {Array.isArray(readWriteColumns) && readWriteColumns.length > 0 && (
          <ReadWriteColumnsContainer
            editingColumnIdx={editingColumnIdx}
            readWriteColumns={readWriteColumns}
            currentColumns={allColumns}
            editorConfig={editorConfig}
            workflowConfig={workflowConfig}
            selectedNode={selectedNode}
            onColumnChanged={this.onColumnChanged}
            setEditingColumnIdx={this.setEditingColumnIdx}
            updateWorkflowConfig={this.props.updateWorkflowConfig}
          />
        )}
      </>
    );
  };

  setWorkflowNodesWidth = (width) => {
    this.workflowNodesRef.style.width = width + 'px';
    localStorage.setItem('workflow_width', width);
    eventBus.dispatch(EVENT_OPERATION_TYPE.UPDATE_WORKFLOW_DESIGN_WIDTH, width);
  };

  render() {
    const { selectedNode, workflowColumns } = this.props;
    const { readOnlyColumns, readWriteColumns, allColumns } = getShowColumns(workflowColumns, selectedNode);
    return (
      <div className="workflow-app-content" >
        <PaneDivider
          setWorkflowNodesWidth={this.setWorkflowNodesWidth}
        />
        <div className="workflow-nodes-container" ref={ref => this.workflowNodesRef = ref}>
          <div className="workflow-nodes-title text-truncate">
            {gettext('Form')}
          </div>
          <div className="app-content-container" onClick={this.cancelEditingColumn} ref={ref => this.appContentContainerRef = ref}>
            <div className="form-items-container">
              {allColumns.length === 0 &&
                <span className="select-node-tip">{gettext('Please set the form fields in the settings panel')}</span>
              }
              {this.getRowItems(allColumns, readWriteColumns, readOnlyColumns)}
              {allColumns.length > 0 && (
                <Button
                  color="primary"
                  className="mb-4 mt-4 flex-shrink-0 d-flex"
                  style={{ margin: '0 10px', width: 'fit-content' }}
                >
                  {gettext('Submit')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

WorkflowNodeColumnsEdit.propTypes = {
  workflowConfig: PropTypes.object,
  selectedNode: PropTypes.object,
  workflowColumns: PropTypes.array,
  editorConfig: PropTypes.object.isRequired,
  changeNode: PropTypes.func,
  updateWorkflowConfig: PropTypes.func,
};

export default html5DragDropContext(WorkflowNodeColumnsEdit);
