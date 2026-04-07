import React, { useCallback, useState } from 'react';
import classnames from 'classnames';
import { Dropdown, DropdownToggle } from 'reactstrap';
import { Icon } from '../../../components';
import { BAR_TYPE_CONFIG, BAR_TYPE } from '../../constants';
import { NAVIGATION_BASE_PADDING } from '@/constants';
import { CustomizeDropdownMenu, CustomizeDropdownItem, CustomizeDropdownItemIcon, CustomizeDropdownItemText } from '../../../components/';

const PortalIssuesMoreNav = ({ onClick }) => {
  const [isShowChildren, setIsShowChildren] = useState(false);

  const toggleShowChildren = useCallback(() => {
    setIsShowChildren(!isShowChildren);
  }, [isShowChildren]);

  const handleItemClick = useCallback((navKey) => {
    onClick([navKey]);
    setIsShowChildren(false);
  }, [onClick]);

  return (
    <Dropdown isOpen={isShowChildren} toggle={toggleShowChildren} className="sea-qa-side-panel-more-nav" direction="right">
      <DropdownToggle
        tag="div"
        className={classnames('sea-qa-project-navigation-item', { 'sea-qa-project-navigation-item-active': isShowChildren })}
        style={{ paddingLeft: NAVIGATION_BASE_PADDING }}
      >
        <Icon symbol={'more'} className="sea-qa-project-navigation-item-icon" />
        <span className="sea-qa-project-navigation-item-name">{window.gettext('More')}</span>
      </DropdownToggle>
      <CustomizeDropdownMenu
        className="position-fixed"
        modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]}
      >
        <CustomizeDropdownItem className="sea-qa-dropdown-item" onClick={() => handleItemClick(BAR_TYPE_CONFIG[BAR_TYPE.PORTAL_ISSUE_TYPES].key)}>
          <CustomizeDropdownItemIcon symbol={'manage-types'} className="sea-qa-dropdown-item-icon" />
          <CustomizeDropdownItemText className="sea-qa-dropdown-item-text">{BAR_TYPE_CONFIG[BAR_TYPE.PORTAL_ISSUE_TYPES].name}</CustomizeDropdownItemText>
        </CustomizeDropdownItem>
        <CustomizeDropdownItem className="sea-qa-dropdown-item" onClick={() => handleItemClick(BAR_TYPE_CONFIG[BAR_TYPE.PORTAL_ISSUE_SUBSTATES].key)}>
          <CustomizeDropdownItemIcon symbol={'manage-types'} className="sea-qa-dropdown-item-icon" />
          <CustomizeDropdownItemText className="sea-qa-dropdown-item-text">{BAR_TYPE_CONFIG[BAR_TYPE.PORTAL_ISSUE_SUBSTATES].name}</CustomizeDropdownItemText>
        </CustomizeDropdownItem>
        <div className="dropdown-divider"></div>
        <CustomizeDropdownItem className="sea-qa-dropdown-item" onClick={() => handleItemClick(BAR_TYPE_CONFIG[BAR_TYPE.PORTAL_ISSUES_TRASH].key)}>
          <CustomizeDropdownItemIcon symbol={'trash'} className="sea-qa-dropdown-item-icon" />
          <CustomizeDropdownItemText className="sea-qa-dropdown-item-text">{BAR_TYPE_CONFIG[BAR_TYPE.PORTAL_ISSUES_TRASH].name}</CustomizeDropdownItemText>
        </CustomizeDropdownItem>
      </CustomizeDropdownMenu>
    </Dropdown>
  );
};

export default PortalIssuesMoreNav;
