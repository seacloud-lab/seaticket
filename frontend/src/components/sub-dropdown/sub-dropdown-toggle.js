import React from 'react';
import { DropdownToggle } from 'reactstrap';
import CustomizeDropdownItem from '../customize-dropdown-item';
import classnames from 'classnames';
const Icon = CustomizeDropdownItem.Icon;
const Text = CustomizeDropdownItem.Text;

export const SubDropdownToggle = ({ text, icon, className, ...params }) => {
  return (
    <DropdownToggle
      tag="div"
      className={classnames('sea-qa-sub-dropdown-toggle dropdown-item font-weight-normal rounded-0 rotate-icon-270', className)}
      { ...params }
    >
      <Text className="mr-auto">{text}</Text>
      <Icon symbol={icon} className="mr-0 mt-0" />
    </DropdownToggle>
  );
};

export default SubDropdownToggle;
