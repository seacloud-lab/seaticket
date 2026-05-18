import React from 'react';
import classnames from 'classnames';
import { Dropdown, DropdownToggle } from 'reactstrap';
import { hasOwnProperty } from '@/utils/object-utils';
import CustomizeDropdownMenu from '../customize-dropdown-menu';
import CustomizeDropdownItem from '../customize-dropdown-item';

import './index.css';

const Icon = CustomizeDropdownItem.Icon;
const Text = CustomizeDropdownItem.Text;

const SubDropdown = ({
  menu,
  direction = 'right',
  isOpen,
  onShow,
  onToggle,
}) => {
  return (
    <Dropdown
      direction={direction}
      className="w-100 d-flex"
      isOpen={isOpen}
      toggle={onToggle}
      onMouseMove={(e) => e.stopPropagation()}
    >
      <DropdownToggle
        tag="div"
        className={classnames('seaqa-sub-dropdown-toggle dropdown-item font-weight-normal rotate-icon-270', menu.className)}
        onMouseEnter={(event) => onShow && onShow(event, menu)}
        onClick={(event) => onToggle && onToggle(event, menu)}
      >
        <Text className="mr-auto">{menu.label}</Text>
        <Icon symbol="arrow-down" className="mr-0 mt-0" />
      </DropdownToggle>
      <CustomizeDropdownMenu fixed={true} style={{ marginLeft: -1 }}>
        {menu.children.map((item) => {
          const { key, label, icon, className, callback } = item;
          if (key === 'divider') {
            return (<CustomizeDropdownItem key={key} divider />);
          }
          return (
            <CustomizeDropdownItem className={className} key={key} onClick={callback ? callback : null}>
              {hasOwnProperty(item, 'icon') ? (
                <>
                  {icon ? (<Icon symbol={icon} className="mr-2" />) : (<span className="mr-2" style={{ height: 16, width: 16, display: 'inline-block' }}></span>)}
                  <Text>{label}</Text>
                </>
              ) : (
                <>{label}</>
              )}
            </CustomizeDropdownItem>
          );
        })}
      </CustomizeDropdownMenu>
    </Dropdown>
  );
};

export default SubDropdown;
