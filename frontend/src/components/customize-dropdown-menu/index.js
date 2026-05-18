import React from 'react';
import { DropdownMenu } from 'reactstrap';
import classnames from 'classnames';

const CustomizeDropdownMenu = ({
  fixed,
  className,
  modifiers = [{ name: 'preventOverflow', options: { boundary: document.body } }],
  children,
  ...params
}) => {
  return (
    <DropdownMenu
      className={classnames('seaqa-dropdown-menu', className, { 'position-fixed': fixed })}
      modifiers={modifiers}
      { ...params }
    >
      {children}
    </DropdownMenu>
  );
};

export default CustomizeDropdownMenu;
