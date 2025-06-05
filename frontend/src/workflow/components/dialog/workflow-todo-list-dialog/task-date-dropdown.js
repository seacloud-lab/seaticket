import React, { Fragment, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownItem, DropdownMenu, DropdownToggle } from 'reactstrap';
import FilterCalendar from '../../../../pages/dtable/dialog/dataset-widgets/filters-widgets/filter-calendar';
import DateTypeDropdown from './date-type-dropdown';
import Icon from '../../../../components/icon';
import { gettext } from '../../../../utils/constants';

const propTypes = {
  toolbarSettings: PropTypes.object,
  setToolbarSettings: PropTypes.func,
};

const TASK_TIME_TYPES = {
  CREATE_TIME: 'create_time',
  UPDATE_TIME: 'update_time',
};

const TIME_RANGE_TYPES = {
  TODAY: 'today',
  THE_PAST_WEEK: 'the_past_week',
  THE_PAST_MONTH: 'the_past_month',
  CUSTOM_TIME: 'custom_time',
};

const timeRangeArray = [
  { value: TIME_RANGE_TYPES.TODAY, labelText: gettext('Today') },
  { value: TIME_RANGE_TYPES.THE_PAST_WEEK, labelText: gettext('Last 7 days') },
  { value: TIME_RANGE_TYPES.THE_PAST_MONTH, labelText: gettext('Last 30 days') },
  { value: TIME_RANGE_TYPES.CUSTOM_TIME, labelText: gettext('Custom time') },
];

const getOptions = (selectedTimeRange) => {
  return timeRangeArray.map((timeRange) => ({
    value: timeRange.value,
    label: (
      <div className="d-flex justify-content-between">
        <span>{timeRange.labelText}</span>
        {selectedTimeRange === timeRange.value && (
          <i className="dtable-font dtable-icon-check-mark ml-1" />
        )}
      </div>
    ),
  }));
};

const TaskDateDropdown = ({ toolbarSettings, setToolbarSettings }) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState(null);
  const [taskTimeType, setTaskTimeType] = useState(TASK_TIME_TYPES.CREATE_TIME);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isShowCustomRange, setIsShowCustomRange] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const customTimeRef = useRef(null);
  const customTimeContainerRef = useRef(null);
  const taskRangeOptions = getOptions(selectedTimeRange);

  const getSelectValue = () => {
    const labelMap = {
      [TASK_TIME_TYPES.CREATE_TIME]: 'Create time',
      [TASK_TIME_TYPES.UPDATE_TIME]: 'Update time',
    };
    const labelValue = labelMap[taskTimeType] || labelMap[TASK_TIME_TYPES.CREATE_TIME];
    if (!selectedTimeRange) {
      return <span>{gettext(labelValue)}</span>;
    }
    if (selectedTimeRange === TIME_RANGE_TYPES.CUSTOM_TIME) {
      return (
        <span>
          {`${gettext(labelValue)}: `}
          {startTime && endTime ? `${startTime} —— ${endTime}` : ''}
        </span>
      );
    }
    const timeRange = timeRangeArray.find((time) => time.value === selectedTimeRange);
    return <div>{gettext(labelValue)}: {timeRange.labelText}</div>;
  };

  const toggle = (e) => {
    if (customTimeRef && customTimeRef.current.contains(e.target)) return;
    if (customTimeContainerRef && customTimeContainerRef.current && customTimeContainerRef.current.contains(e.target)) return;
    setDropdownOpen(!dropdownOpen);
  };

  const resetCustomTime = () => {
    if (startTime) setStartTime('');
    if (endTime) setEndTime('');
    if (isShowCustomRange) setIsShowCustomRange(false);
  };

  const handleSelectedTime = (optionValue) => {
    if (optionValue === selectedTimeRange) return;
    setSelectedTimeRange(optionValue);
    updatedToolbarSettings(optionValue);
    resetCustomTime();
  };

  const handleCustomTime = (e) => {
    e.stopPropagation();
    setIsShowCustomRange(true);
    setSelectedTimeRange(timeRangeArray.CREATE_TIME);
    setStartTime('');
    setEndTime('');
  };

  const deleteSelectedTime = () => {
    if (selectedTimeRange === TIME_RANGE_TYPES.CUSTOM_TIME) {
      setStartTime('');
      setEndTime('');
      setIsShowCustomRange(false);
    }
    setSelectedTimeRange(null);
    updatedToolbarSettings(null);
  };

  const updatedToolbarSettings = (selectedTimeRange) => {
    const updatedSetting = {
      ...toolbarSettings,
      taskTimeType,
      selectedTimeRange,
    };
    setToolbarSettings(updatedSetting);
  };

  useEffect(() => {
    if (startTime && endTime) {
      const updatedSelectedTime = {
        type: TIME_RANGE_TYPES.CUSTOM_TIME,
        startTime,
        endTime,
      };
      setSelectedTimeRange(TIME_RANGE_TYPES.CUSTOM_TIME);
      setStartTime(startTime);
      setEndTime(endTime);
      const updatedWorkflowTaskSetting = {
        ...toolbarSettings,
        taskTimeType,
        selectedTimeRange: updatedSelectedTime,
      };
      setToolbarSettings(updatedWorkflowTaskSetting);
    }
  }, [startTime, endTime]);

  return (
    <Dropdown
      className="task-date-dropdown task-dropdown mr-2"
      isOpen={dropdownOpen}
      toggle={toggle}
    >
      <DropdownToggle tag="div" role="button" className="task-dropdown-toggle">
        <div className="selected-value d-flex align-items-center">
          <Icon className="option-icon mr-1" symbol="initiation-time" />
          {getSelectValue()}
        </div>
        <i className="dtable-font dtable-icon-down3 ml-1" />
      </DropdownToggle>
      <DropdownMenu className="task-date-dropdown-menu task-dropdown-menu">
        <div className="custom-time-header d-flex justify-content-between align-items-center">
          <DateTypeDropdown
            taskTimeType={taskTimeType}
            setTaskTimeType={setTaskTimeType}
          />
          <div className="d-flex justify-content-between">
            <i className="dtable-font dtable-icon-delete" onClick={deleteSelectedTime} />
          </div>
        </div>
        {taskRangeOptions.map(option => {
          if (option.value === TIME_RANGE_TYPES.CUSTOM_TIME) {
            return (
              <Fragment key={option.value}>
                <DropdownItem divider />
                <div ref={customTimeRef}>
                  <DropdownItem onClick={handleCustomTime}>
                    {option.label}
                  </DropdownItem>
                </div>
              </Fragment>
            );
          }
          return (
            <DropdownItem key={option.value} onClick={() => handleSelectedTime(option.value)}>
              {option.label}
            </DropdownItem>
          );
        })}
        {isShowCustomRange && (
          <div className="custom-time-range-container d-flex" ref={customTimeContainerRef}>
            <div className="start-time-container">
              <span>{gettext('Start time')}</span>
              <FilterCalendar
                value={startTime}
                onChange={(value) => setStartTime(value)}
                filterColumn={null}
              />
            </div>
            <div className="end-time-container">
              <span>{gettext('End time')}</span>
              <FilterCalendar
                value={endTime}
                onChange={(value) => setEndTime(value)}
                filterColumn={null}
              />
            </div>
          </div>
        )}
      </DropdownMenu>
    </Dropdown>
  );
};

TaskDateDropdown.propTypes = propTypes;

export default TaskDateDropdown;
