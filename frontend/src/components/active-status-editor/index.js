import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import classnames from 'classnames';
import Icon from '../icon';

import './index.css';

const ActiveStatusEditor = ({ isShowDropdownIcon, currentOption, menuOptions, onChangeOption, closeShowDropdownIcon }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClickMenuOption = (menuOption) => {
    const { value } = menuOption;
    closeShowDropdownIcon && closeShowDropdownIcon();
    if (value === currentOption.value) return;
    onChangeOption(value);
  };

  return (
    <Dropdown
      isOpen={isOpen}
      className="active-status-editor"
      toggle={() => setIsOpen(!isOpen)}
    >
      <DropdownToggle className="dropdown-toggle-button d-flex align-items-center" tag="div">
        {currentOption.label}
        <div className="dropdown-icon-container ml-1">
          <Icon symbol="arrow-down" className={classnames('sea-qa-role-status-down-icon', { 'd-none': !isShowDropdownIcon })}/>
        </div>
      </DropdownToggle>
      <DropdownMenu
        className="position-fixed"
        modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]}
      >
        {menuOptions.map(option => {
          const { value, label } = option;
          return (
            <DropdownItem key={`item-${value}`} onClick={() => handleClickMenuOption(option)}>
              {label}
              {value === currentOption.value && (
                <Icon symbol="check-mark" className="sea-qa-role-status-check ml-2" />
              )}
            </DropdownItem>
          );
        })}
      </DropdownMenu>
    </Dropdown>
  );
};

ActiveStatusEditor.propTypes = {
  isShowDropdownIcon: PropTypes.bool.isRequired,
  currentOption: PropTypes.object.isRequired,
  menuOptions: PropTypes.array.isRequired,
  onChangeOption: PropTypes.func.isRequired,
  closeShowDropdownIcon: PropTypes.func.isRequired,
};

export default ActiveStatusEditor;
