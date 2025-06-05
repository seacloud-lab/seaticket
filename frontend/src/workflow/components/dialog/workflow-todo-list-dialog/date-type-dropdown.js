import React, { useState } from 'react';
import { PropTypes } from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { gettext } from '../../../../utils/constants';

const propTypes = {
  taskTimeType: PropTypes.string,
  setTaskTimeType: PropTypes.func,
};

const typeOptions = [
  { value: 'create_time', label: gettext('Create time') },
  { value: 'update_time', label: gettext('Update time') },
];

const DateTypeDropdown = ({ taskTimeType, setTaskTimeType }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const changeTaskTimeType = (value) => {
    setTaskTimeType(value);
  };

  const optionLabel = typeOptions.find(item => item.value === taskTimeType)?.label || {};

  return (
    <Dropdown className="date-type-dropdown" isOpen={dropdownOpen} toggle={() => setDropdownOpen(!dropdownOpen)}>
      <DropdownToggle tag="div" role="button" className="d-flex align-items-center p-1">
        {optionLabel}
        <i className="dtable-font dtable-icon-down3 ml-1"/>
      </DropdownToggle>
      <DropdownMenu>
        {typeOptions.map(option => (
          <DropdownItem key={option.value} onClick={() => changeTaskTimeType(option.value)}>
            <div className="d-flex justify-content-between align-items-center">
              {option.label}
              {taskTimeType === option.value && (
                <i className="dtable-font dtable-icon-check-mark ml-1"/>
              )}
            </div>
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
};

DateTypeDropdown.propTypes = propTypes;

export default DateTypeDropdown;
