import React, { useCallback, useState } from 'react';
import classnames from 'classnames';
import { Dropdown, DropdownToggle } from 'reactstrap';
import { Icon } from '../../../components';
import { BAR_TYPE_CONFIG, BAR_TYPE } from '../../constants';
import { NAVIGATION_BASE_PADDING } from '@/constants';
import { CustomizeDropdownMenu, CustomizeDropdownItem, CustomizeDropdownItemIcon, CustomizeDropdownItemText } from '../../../components/';

const DefaultMoreNav = ({ onClick }) => {
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
        <CustomizeDropdownItem onClick={() => handleItemClick(BAR_TYPE_CONFIG[BAR_TYPE.SEARCH].key)}>
          <CustomizeDropdownItemIcon symbol={BAR_TYPE_CONFIG[BAR_TYPE.SEARCH].icon} />
          <CustomizeDropdownItemText>{BAR_TYPE_CONFIG[BAR_TYPE.SEARCH].name}</CustomizeDropdownItemText>
        </CustomizeDropdownItem>
        <CustomizeDropdownItem onClick={() => handleItemClick(BAR_TYPE_CONFIG[BAR_TYPE.TAGS].key)}>
          <CustomizeDropdownItemIcon symbol={BAR_TYPE_CONFIG[BAR_TYPE.TAGS].icon} />
          <CustomizeDropdownItemText>{BAR_TYPE_CONFIG[BAR_TYPE.TAGS].name}</CustomizeDropdownItemText>
        </CustomizeDropdownItem>
      </CustomizeDropdownMenu>
    </Dropdown>
  );
};

export default DefaultMoreNav;
