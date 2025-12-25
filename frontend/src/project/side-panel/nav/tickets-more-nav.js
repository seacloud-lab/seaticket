import React, { useCallback, useState } from 'react';
import classnames from 'classnames';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { Icon } from '../../../components';
import { BAR_TYPES } from '../../constants';

import './tickets-more-nav.css';

const TicketsMoreNav = ({ onClick }) => {
  const [isShowChildren, setIsShowChildren] = useState(false);

  const toggleShowChildren = useCallback(() => {
    setIsShowChildren(!isShowChildren);
  }, [isShowChildren]);

  const handleItemClick = useCallback((navKey) => {
    onClick([navKey]);
    setIsShowChildren(false);
  }, [onClick]);

  return (
    <Dropdown isOpen={isShowChildren} toggle={toggleShowChildren} className="sea-qa-tickets-more-nav" direction="right">
      <DropdownToggle
        tag="div"
        className={classnames('sea-qa-project-navigation-item')}
        style={{ paddingLeft: 8 }}
      >
        <Icon symbol={'more'} className="sea-qa-project-navigation-item-icon" />
        <span className="sea-qa-project-navigation-item-name">{window.gettext('More')}</span>
      </DropdownToggle>
      <DropdownMenu
        className="position-fixed"
        modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]}
      >
        <DropdownItem className="sea-qa-dropdown-item" onClick={() => handleItemClick(BAR_TYPES[8].key)}>
          <Icon symbol={BAR_TYPES[8].icon} />
          <span className="ml-2">{BAR_TYPES[8].name}</span>
        </DropdownItem>
        <DropdownItem className="sea-qa-dropdown-item" onClick={() => handleItemClick(BAR_TYPES[9].key)}>
          <Icon symbol={BAR_TYPES[9].icon} />
          <span className="ml-2">{BAR_TYPES[9].name}</span>
        </DropdownItem>
        <DropdownItem className="sea-qa-dropdown-item" onClick={() => handleItemClick(BAR_TYPES[10].key)}>
          <Icon symbol={BAR_TYPES[10].icon} />
          <span className="ml-2">{BAR_TYPES[10].name}</span>
        </DropdownItem>
        <DropdownItem className="sea-qa-dropdown-item" onClick={() => handleItemClick(BAR_TYPES[11].key)}>
          <Icon symbol={BAR_TYPES[11].icon} />
          <span className="ml-2">{BAR_TYPES[11].name}</span>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};

export default TicketsMoreNav;
