import React from 'react';
import { Dropdown } from 'reactstrap';
import { hasOwnProperty } from '@/utils/object-utils';
import CustomizeDropdownMenu from '../customize-dropdown-menu';
import CustomizeDropdownItem from '../customize-dropdown-item';
import SubDropdownToggle from './sub-dropdown-toggle';

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
      <SubDropdownToggle
        text={menu.name}
        className={menu.className}
        icon="down"
        onMouseEnter={(event) => onShow && onShow(event, menu)}
        onClick={(event) => onToggle && onToggle(event, menu)}
      />
      <CustomizeDropdownMenu fixed={true} style={{ marginLeft: -16 }}>
        {menu.children.map((item) => {
          const { key, name, icon, className, callback } = item;
          if (key === 'divider') {
            return <CustomizeDropdownItem key={key} divider />;
          }
          return (
            <CustomizeDropdownItem className={className} key={key} onClick={callback ? callback : null}>
              {hasOwnProperty(item, 'icon') ? (
                <>
                  {icon ? (<Icon symbol={icon} className="mr-2" />) : (<span className="mr-2" style={{ height: 16, width: 16, display: 'inline-block' }}></span>)}
                  <Text>{name}</Text>
                </>
              ) : (
                <>{name}</>
              )}
            </CustomizeDropdownItem>
          );
        })}
      </CustomizeDropdownMenu>
    </Dropdown>
  );
};

export default SubDropdown;
