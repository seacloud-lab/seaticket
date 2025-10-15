import React from 'react';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import Icon from '../icon';
import { hasOwnProperty } from '@/utils/object-utils';

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
      className="w-100"
      isOpen={isOpen}
      toggle={onToggle}
      onMouseMove={(e) => e.stopPropagation()}
    >
      <DropdownToggle
        tag="div"
        className="dropdown-item font-weight-normal rounded-0 d-flex align-items-center rotate-icon-270"
        onMouseEnter={(event) => onShow && onShow(event, menu)}
        onClick={(event) => onToggle && onToggle(event, menu)}
      >
        <span className="mr-auto">{menu.name}</span>
        <Icon className="item-icon" symbol="down" />
      </DropdownToggle>
      <DropdownMenu
        className="position-fixed"
        style={{ marginLeft: -16 }}
        modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]}
      >
        {menu.children.map((item) => {
          const { key, name, icon, callback } = item;
          if (key === 'divider') {
            return <DropdownItem key={key} divider />;
          }
          return (
            <DropdownItem key={key} onClick={callback ? callback : null}>
              {hasOwnProperty(item, 'icon') && (
                <>
                  {icon ? (<Icon symbol={icon} className="mr-2" />) : (<span className="mr-2" style={{ height: 16, width: 16, display: 'inline-block' }}></span>)}
                </>
              )}
              <span>{name}</span>
            </DropdownItem>
          );
        })}
      </DropdownMenu>
    </Dropdown>
  );
};

export default SubDropdown;
