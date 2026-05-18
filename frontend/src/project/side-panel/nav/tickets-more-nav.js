import React, { useCallback, useState } from 'react';
import classnames from 'classnames';
import { Dropdown, DropdownToggle } from 'reactstrap';
import { Icon } from '../../../components';
import { BAR_TYPE_CONFIG, BAR_TYPE } from '../../constants';
import { NAVIGATION_BASE_PADDING } from '@/constants';
import { CustomizeDropdownMenu, CustomizeDropdownItem, CustomizeDropdownItemIcon, CustomizeDropdownItemText } from '../../../components/';

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
    <Dropdown isOpen={isShowChildren} toggle={toggleShowChildren} className="seaqa-side-panel-more-nav" direction="right">
      <DropdownToggle
        tag="div"
        className={classnames('seaqa-project-navigation-item', { 'seaqa-project-navigation-item-active': isShowChildren })}
        style={{ paddingLeft: NAVIGATION_BASE_PADDING }}
      >
        <Icon symbol={'more'} className="seaqa-project-navigation-item-icon" />
        <span className="seaqa-project-navigation-item-name">{window.gettext('More')}</span>
      </DropdownToggle>
      <CustomizeDropdownMenu
        className="position-fixed"
        modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]}
      >
        <CustomizeDropdownItem className="seaqa-dropdown-item" onClick={() => handleItemClick(BAR_TYPE_CONFIG[BAR_TYPE.TYPES].key)}>
          <CustomizeDropdownItemIcon symbol={'manage-types'} className="seaqa-dropdown-item-icon" />
          <CustomizeDropdownItemText className="seaqa-dropdown-item-text">{BAR_TYPE_CONFIG[BAR_TYPE.TYPES].name}</CustomizeDropdownItemText>
        </CustomizeDropdownItem>
        <CustomizeDropdownItem className="seaqa-dropdown-item" onClick={() => handleItemClick(BAR_TYPE_CONFIG[BAR_TYPE.SUBSTATES].key)}>
          <CustomizeDropdownItemIcon symbol={'manage-types'} className="seaqa-dropdown-item-icon" />
          <CustomizeDropdownItemText className="seaqa-dropdown-item-text">{BAR_TYPE_CONFIG[BAR_TYPE.SUBSTATES].name}</CustomizeDropdownItemText>
        </CustomizeDropdownItem>
        <div className="dropdown-divider"></div>
        <CustomizeDropdownItem className="seaqa-dropdown-item" onClick={() => handleItemClick(BAR_TYPE_CONFIG[BAR_TYPE.TRASH].key)}>
          <CustomizeDropdownItemIcon symbol={'trash'} className="seaqa-dropdown-item-icon" />
          <CustomizeDropdownItemText className="seaqa-dropdown-item-text">{BAR_TYPE_CONFIG[BAR_TYPE.TRASH].name}</CustomizeDropdownItemText>
        </CustomizeDropdownItem>
      </CustomizeDropdownMenu>
    </Dropdown>
  );
};

export default TicketsMoreNav;
