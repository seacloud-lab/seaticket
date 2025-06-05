import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownItem, DropdownMenu, DropdownToggle } from 'reactstrap';
import Icon from '../../../../components/icon';
import { gettext } from '../../../../utils/constants';

const propTypes = {
  taskList: PropTypes.array,
  toolbarSettings: PropTypes.object,
  setToolbarSettings: PropTypes.func,
};

const ORDER_TYPE = {
  NEWEST_FIRST: 'newest_first',
  OLDEST_FIRST: 'oldest_first',
  RECENTLY_UPDATED: 'recently_updated',
  LEAST_RECENTLY_UPDATED: 'least_recently_updated',
};

const orderOptionArray = [
  { value: ORDER_TYPE.NEWEST_FIRST, labelText: gettext('Newest first') },
  { value: ORDER_TYPE.OLDEST_FIRST, labelText: gettext('Oldest first') },
  { value: ORDER_TYPE.RECENTLY_UPDATED, labelText: gettext('Recently updated') },
  { value: ORDER_TYPE.LEAST_RECENTLY_UPDATED, labelText: gettext('Least recently updated') },
];

const createOption = (value, labelText, selectedSortType) => {
  const isSelected = selectedSortType === value;
  return {
    value,
    label: (
      <div className="d-flex justify-content-between align-items-center">
        <span>{labelText}</span>
        {isSelected && (
          <i className="dtable-font dtable-icon-check-mark ml-1" />
        )}
      </div>
    )
  };
};

const getOptions = (selectedSortType) => {
  return orderOptionArray.map(orderOption => {
    return createOption(orderOption.value, orderOption.labelText, selectedSortType);
  });
};

const TaskSortDropdown = ({ toolbarSettings, setToolbarSettings }) => {
  const { selectedWorkflowOrder = ORDER_TYPE.NEWEST_FIRST } = toolbarSettings;
  const [selectedSortType, setSelectedSortType] = useState(selectedWorkflowOrder);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const taskSortTypeOptions = getOptions(selectedSortType);
  const selectedSortTypeOption = taskSortTypeOptions.find(option => option.value === selectedSortType) || null;

  const onChangeSelectOption = (optionValue) => {
    if (optionValue === selectedSortType) return;
    setSelectedSortType(optionValue);
    const updatedWorkflowTaskSetting = {
      ...toolbarSettings,
      selectedWorkflowOrder: optionValue,
    };
    localStorage.setItem('selectedWorkflowOrder', optionValue);
    setToolbarSettings(updatedWorkflowTaskSetting);
  };

  return (
    <Dropdown
      className="task-sort-dropdown task-dropdown mr-2"
      isOpen={dropdownOpen}
      toggle={() => setDropdownOpen(!dropdownOpen)}
    >
      <DropdownToggle tag="div" role="button" className="task-dropdown-toggle">
        <div className="selected-value d-flex align-items-center">
          <Icon className="option-icon mr-1" symbol="sort" />
          {gettext('Sort')}
          {': '}
          {selectedSortTypeOption && selectedSortTypeOption.label}
        </div>
        <i className="dtable-font dtable-icon-down3 ml-1" />
      </DropdownToggle>
      <DropdownMenu className="task-dropdown-menu">
        {taskSortTypeOptions.map(orderOption => {
          return (
            <DropdownItem
              key={orderOption.value}
              onClick={() => onChangeSelectOption(orderOption.value)}
            >
              {orderOption.label}
            </DropdownItem>
          );
        })}
      </DropdownMenu>
    </Dropdown>
  );
};

TaskSortDropdown.propTypes = propTypes;

export default TaskSortDropdown;
