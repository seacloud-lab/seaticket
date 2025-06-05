import React from 'react';
import PropTypes from 'prop-types';
import TaskTypeDropdown from './task-type-dropdown';
import TaskSortDropdown from './task-sort-dropdown';
import TaskInitiatorDropdown from './task-initiator-dropdown';
import TaskDateDropdown from './task-date-dropdown';
import TaskNodeDropdown from './task-node-dropdown';
import TaskSearchInput from './task-search-input';

const propTypes = {
  totalCount: PropTypes.number,
  countDetails: PropTypes.array,
  taskList: PropTypes.array,
  toolbarSettings: PropTypes.object,
  setToolbarSettings: PropTypes.func,
};

const WorkflowTaskListToolbar = ({ taskList, totalCount, countDetails, toolbarSettings, setToolbarSettings }) => {
  return (
    <div className="workflow-task-list-toolbar-container">
      <div className="toolbar d-flex justify-content-between">
        <div className="toolbar-left-section">
          <TaskTypeDropdown
            taskList={taskList}
            totalCount={totalCount}
            countDetails={countDetails}
            toolbarSettings={toolbarSettings}
            setToolbarSettings={setToolbarSettings}
          />
          <TaskSortDropdown
            taskList={taskList}
            toolbarSettings={toolbarSettings}
            setToolbarSettings={setToolbarSettings}
          />
          <TaskInitiatorDropdown
            taskList={taskList}
            toolbarSettings={toolbarSettings}
            setToolbarSettings={setToolbarSettings}
          />
          <TaskDateDropdown
            toolbarSettings={toolbarSettings}
            setToolbarSettings={setToolbarSettings}
          />
          <TaskNodeDropdown
            taskList={taskList}
            toolbarSettings={toolbarSettings}
            setToolbarSettings={setToolbarSettings}
          />
        </div>
        <div className="toolbar-right-section">
          <TaskSearchInput
            toolbarSettings={toolbarSettings}
            setToolbarSettings={setToolbarSettings}
          />
        </div>
      </div>
    </div>
  );
};

WorkflowTaskListToolbar.propTypes = propTypes;

export default WorkflowTaskListToolbar;
