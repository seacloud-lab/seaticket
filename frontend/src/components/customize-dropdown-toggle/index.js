import React from 'react';
import { DropdownToggle } from 'reactstrap';
import classnames from 'classnames';
import Icon from '../icon';
import { gettext } from '../../constants';

const CustomizeDropdownMoreToggle = ({ isOpen, title, className, ...props }) => {

  return (
    <DropdownToggle
      tag="div"
      role="button"
      className={classnames('cursor-pointer attr-action-icon sea-qa-icon-btn', className)}
      title={title || gettext('More operations')}
      aria-label={title || gettext('More operations')}
      data-toggle="dropdown"
      aria-expanded={isOpen}
      {...props}
    >
      <Icon symbol="more" />
    </DropdownToggle>
  );
};

export default CustomizeDropdownMoreToggle;
