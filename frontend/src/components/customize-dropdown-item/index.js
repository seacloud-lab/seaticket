import React from 'react';
import { DropdownItem } from 'reactstrap';
import classnames from 'classnames';
import { Icon } from '..';

const CustomizeDropdownItem = ({ className, children, ...params }) => {
  return (
    <DropdownItem className={classnames('sea-qa-dropdown-item', className)} { ...params}>
      {children}
    </DropdownItem>
  );
};

const CustomizeDropdownItemIcon = ({ className, position, ...params }) => {
  return (
    <Icon className={classnames('item-icon', className, { [`item-icon-${position}`]: position })} { ...params }/>
  );
};

const CustomizeDropdownItemText = ({ className, children, ...params }) => {
  return (
    <span className={classnames('item-text', className)} { ...params }>
      {children}
    </span>
  );
};

CustomizeDropdownItem.Icon = CustomizeDropdownItemIcon;
CustomizeDropdownItem.Text = CustomizeDropdownItemText;

export default CustomizeDropdownItem;

export {
  CustomizeDropdownItemIcon,
  CustomizeDropdownItemText,
};
