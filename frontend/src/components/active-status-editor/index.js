import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle } from 'reactstrap';
import CustomDropdownMenu from '../customize-dropdown-menu';
import CustomizeDropdownItem from '../customize-dropdown-item';
import classnames from 'classnames';
import Icon from '../icon';
import IconButton from '../icon-button';
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
          <Icon symbol="arrow-down" className={classnames('seaqa-role-status-down-icon', { 'd-none': !isShowDropdownIcon })}/>
        </div>
      </DropdownToggle>
      <CustomDropdownMenu
        fixed={true}
        modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]}
      >
        {menuOptions.map(option => {
          const { value, label } = option;
          return (
            <CustomizeDropdownItem key={`item-${value}`} onClick={() => handleClickMenuOption(option)} className="justify-content-between">
              {label}
              <IconButton icon={value === currentOption.value ? 'check-mark' : ''} size={14} className="ml-2 no-hover-bg" />
            </CustomizeDropdownItem>
          );
        })}
      </CustomDropdownMenu>
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
