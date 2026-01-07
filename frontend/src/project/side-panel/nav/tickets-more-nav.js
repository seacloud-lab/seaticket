import React, { useCallback, useState } from 'react';
import classnames from 'classnames';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { Icon } from '../../../components';
import { BAR_TYPE_CONFIG, BAR_TYPE } from '../../constants';

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
        <DropdownItem className="sea-qa-dropdown-item" onClick={() => handleItemClick(BAR_TYPE_CONFIG[BAR_TYPE.TAGS].key)}>
          <span>{BAR_TYPE_CONFIG[BAR_TYPE.TAGS].name}</span>
        </DropdownItem>
        <DropdownItem className="sea-qa-dropdown-item" onClick={() => handleItemClick(BAR_TYPE_CONFIG[BAR_TYPE.TYPES].key)}>
          <span>{BAR_TYPE_CONFIG[BAR_TYPE.TYPES].name}</span>
        </DropdownItem>
        <DropdownItem className="sea-qa-dropdown-item" onClick={() => handleItemClick(BAR_TYPE_CONFIG[BAR_TYPE.SUBSTATES].key)}>
          <span>{BAR_TYPE_CONFIG[BAR_TYPE.SUBSTATES].name}</span>
        </DropdownItem>
        <div className="dropdown-divider"></div>
        <DropdownItem className="sea-qa-dropdown-item" onClick={() => handleItemClick(BAR_TYPE_CONFIG[BAR_TYPE.TRASH].key)}>
          <span>{BAR_TYPE_CONFIG[BAR_TYPE.TRASH].name}</span>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};

export default TicketsMoreNav;
