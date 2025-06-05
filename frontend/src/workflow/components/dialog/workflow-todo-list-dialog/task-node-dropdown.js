import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownItem, DropdownMenu, DropdownToggle } from 'reactstrap';
import classnames from 'classnames';
import Icon from '../../../../components/icon';
import { gettext } from '../../../../utils/constants';

const propTypes = {
  taskList: PropTypes.array,
  toolbarSettings: PropTypes.object,
  setToolbarSettings: PropTypes.func,
};

const createOption = (processNode, selectedNodes) => {
  const isSelected = selectedNodes && selectedNodes.includes(processNode);
  return {
    value: processNode,
    label: (
      <div className="d-flex justify-content-between">
        <span>{processNode}</span>
        {isSelected && (
          <i className="dtable-font dtable-icon-check-mark ml-1" />
        )}
      </div>
    )
  };
};

const getOptions = (taskList, selectedNodes, toolbarSettings) => {
  const nodeNameSet = new Set();
  const { selectedWorkflowId = '-1' } = toolbarSettings;
  const workflowTaskList = selectedWorkflowId === '-1' ? [] : taskList.filter(task => {
    const { dtable_workflow: { id } } = task;
    return id === Number(selectedWorkflowId);
  });
  const processNodeList = workflowTaskList.reduce((arr, task) => {
    const { state } = task;
    const { name: nodeName } = state || {};
    if (!nodeNameSet.has(nodeName)) {
      nodeNameSet.add(nodeName);
      arr.push(nodeName);
    }
    return arr;
  }, []);

  return processNodeList.map(processNode => {
    return createOption(processNode, selectedNodes);
  });
};

const TaskNodeDropdown = ({ taskList, toolbarSettings, setToolbarSettings }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const processNodeOptions = getOptions(taskList, selectedNodes, toolbarSettings);

  useEffect(() => {
    if (selectedNodes.length > 0) {
      const updated = [];
      selectedNodes.forEach(node => {
        processNodeOptions.forEach(nodeOption => {
          if (nodeOption && nodeOption.value === node) {
            updated.push(node);
          }
        });
      });
      setSelectedNodes(updated);
      updatedToolbarSettings(updated);
    }
  // eslint-disable-next-line
  }, [toolbarSettings.selectedWorkflowId]);

  const getDisplayNodes = () => {
    const delimiter = ', ';
    if (selectedNodes.length < 1) {
      return (gettext('Task node'));
    }
    const nodeNames = selectedNodes.map(node => node);
    const displayNodes = nodeNames.join(delimiter);
    return `${gettext('Task node')}: ${displayNodes}`;
  };

  const toggle = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const deleteAllNodes = () => {
    setSelectedNodes([]);
    updatedToolbarSettings([]);
  };

  const handleNodeOptionClick = (nodeValue) => {
    const updatedSelectedNodes = [...selectedNodes];
    const nodeIndex = updatedSelectedNodes.findIndex(node => node === nodeValue);
    if (nodeIndex > -1) {
      updatedSelectedNodes.splice(nodeIndex, 1);
    } else {
      updatedSelectedNodes.push(nodeValue);
    }
    setSelectedNodes(updatedSelectedNodes);
    updatedToolbarSettings(updatedSelectedNodes);
  };

  const updatedToolbarSettings = (selectedNodes) => {
    const updatedSetting = {
      ...toolbarSettings,
      selectedNodes,
    };
    setToolbarSettings(updatedSetting);
  };

  const getDisableStatus = () => {
    if (
      (Object.prototype.hasOwnProperty.call(
        toolbarSettings,
        'selectedWorkflowId'
      ) &&
        toolbarSettings.selectedWorkflowId === '-1') ||
      !Object.prototype.hasOwnProperty.call(
        toolbarSettings,
        'selectedWorkflowId'
      )
    ) {
      return true;
    }
    return false;
  };

  return (
    <Dropdown
      className={classnames('task-node-dropdown task-dropdown', { 'disabled': getDisableStatus() })}
      isOpen={dropdownOpen}
      disabled={getDisableStatus()}
      toggle={toggle}
    >
      <DropdownToggle tag="div" role="button" className="task-node-dopdown-toggle task-dropdown-toggle">
        <div className="select-value d-flex align-items-center">
          <Icon className="option-icon mr-1" symbol="nodes" />
          <div className="text-truncate">
            <span>{getDisplayNodes()}</span>
          </div>
        </div>
        <i className="dtable-font dtable-icon-down3 ml-1" />
      </DropdownToggle>
      <DropdownMenu className="task-dropdown-menu">
        <div className="process-node-header">
          <div className="d-flex justify-content-between align-items-center">
            <span>{gettext('Task node')}</span>
            <i className="dtable-font dtable-icon-delete" onClick={deleteAllNodes}/>
          </div>
        </div>
        {processNodeOptions.map((option, index) => {
          return (
            <DropdownItem key={`node-option-${index}`} onClick={() => handleNodeOptionClick(option.value)}>
              {option.label}
            </DropdownItem>
          );
        })}
      </DropdownMenu>
    </Dropdown>
  );
};

TaskNodeDropdown.propTypes = propTypes;

export default TaskNodeDropdown;
