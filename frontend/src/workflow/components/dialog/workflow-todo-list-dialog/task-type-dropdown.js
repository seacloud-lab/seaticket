import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownItem, DropdownMenu, DropdownToggle } from 'reactstrap';
import { gettext } from '../../../../utils/constants';

const propTypes = {
  totalCount: PropTypes.number,
  countDetails: PropTypes.array,
  taskList: PropTypes.array,
  toolbarSettings: PropTypes.object,
  setToolbarSettings: PropTypes.func,
};

const createOption = (optionValue, labelText, tasksCount, selectedWorkflowTaskType) => {
  const isSelected = selectedWorkflowTaskType && selectedWorkflowTaskType.value === optionValue;
  return {
    value: optionValue,
    label: (
      <div className="d-flex justify-content-between align-items-center">
        <div className="workflow-type-value">
          <span className="text-truncate">{labelText}</span>
          <span className="task-count ml-1 mr-1">{tasksCount}</span>
        </div>
        {isSelected && (
          <i className="dtable-font dtable-icon-check-mark" />
        )}
      </div>
    ),
  };
};

const getOptions = (totalCount, countDetails, selectedWorkflowTaskType) => {
  const taskCount = {};
  if (Array.isArray(countDetails) && countDetails.length > 0) {
    for (let i = 0; i < countDetails.length; i++) {
      const detail = countDetails[i];
      taskCount[detail.workflow_id] = {
        count: detail.count,
        name: detail.workflow_name
      };
    }
  }

  const allTasksOption = createOption('-1', gettext('All task'), totalCount, selectedWorkflowTaskType);
  const options = [
    allTasksOption,
    ...Object.keys(taskCount).map((taskId) =>
      createOption(
        taskId,
        taskCount[taskId].name,
        taskCount[taskId].count,
        selectedWorkflowTaskType
      )
    ),
  ];
  return options;
};

const TaskTypeDropdown = ({ taskList, totalCount, countDetails, toolbarSettings, setToolbarSettings }) => {
  const [selectedWorkflowTaskType, setSelectedWorkflowTaskType] = useState();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const workflowTaskTypeOptions = getOptions(totalCount, countDetails, selectedWorkflowTaskType);

  useEffect(() => {
    const initSelectedWorkflowTaskType = createOption('-1', gettext('All task'), totalCount, null);
    setSelectedWorkflowTaskType(initSelectedWorkflowTaskType);
  }, [totalCount]);

  // if load more workflow, should update selectedWorkflowTaskType count
  useEffect(() => {
    if (!selectedWorkflowTaskType) return;
    const { value } = selectedWorkflowTaskType;
    const optionWithoutMark = getOptions(totalCount, countDetails, null);
    const workflowTask = optionWithoutMark.find(task => task.value === value);
    setSelectedWorkflowTaskType(workflowTask);
  }, [taskList]);

  const onChangeSelectedWorkflowTaskType = (workflowId) => {
    if (workflowId === (selectedWorkflowTaskType && selectedWorkflowTaskType.value)) return;
    const updated = workflowTaskTypeOptions.find(workflowTaskType => workflowTaskType.value === workflowId);
    setSelectedWorkflowTaskType(updated);
    const updatedWorkflowTaskSetting = {
      ...toolbarSettings,
      selectedWorkflowId: workflowId,
    };
    setToolbarSettings(updatedWorkflowTaskSetting);
  };

  return (
    <Dropdown
      className="task-type-dropdown task-dropdown mr-2"
      isOpen={dropdownOpen}
      toggle={() => setDropdownOpen(!dropdownOpen)}
    >
      <DropdownToggle tag="div" role="button" className="task-type-dropdown-toggle task-dropdown-toggle">
        <div className="selected-value d-flex align-items-center">
          {selectedWorkflowTaskType && selectedWorkflowTaskType.label}
        </div>
        <i className="dtable-font dtable-icon-down3 ml-1" />
      </DropdownToggle>
      <DropdownMenu className="task-dropdown-menu">
        {workflowTaskTypeOptions.map(taskType => {
          return (
            <DropdownItem key={taskType.value} onClick={() => onChangeSelectedWorkflowTaskType(taskType.value)}>
              {taskType.label}
            </DropdownItem>
          );
        })}
      </DropdownMenu>
    </Dropdown>
  );
};

TaskTypeDropdown.propTypes = propTypes;

export default TaskTypeDropdown;
