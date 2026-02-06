import React, { useCallback, useState } from 'react';
import classnames from 'classnames';
import { Dropdown, DropdownToggle } from 'reactstrap';
import { Icon } from '../../../components';
import { BAR_TYPE_CONFIG, BAR_TYPE } from '../../constants';
import { NAVIGATION_BASE_PADDING } from '@/constants';
import { CustomizeDropdownMenu, CustomizeDropdownItem, CustomizeDropdownItemIcon, CustomizeDropdownItemText } from '../../../components/';
import ImportDialog from '@/project/components/import-dialog';

const KnowledgeMoreNav = ({ onClick }) => {
  const [isShowChildren, setIsShowChildren] = useState(false);
  const [isShowImportDialog, setIsShowImportDialog] = useState(false);

  const toggleShowChildren = useCallback(() => {
    setIsShowChildren(!isShowChildren);
  }, [isShowChildren]);

  const handleTrashClick = useCallback(() => {
    onClick([BAR_TYPE_CONFIG[BAR_TYPE.KNOWLEDGE_TRASH].key]);
    setIsShowChildren(false);
  }, [onClick]);

  const handleImportClick = useCallback(() => {
    setIsShowImportDialog(true);
  }, []);

  return (
    <>
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
          <CustomizeDropdownItem className="sea-qa-dropdown-item" onClick={handleImportClick}>
            <CustomizeDropdownItemIcon symbol={'import-xlsx'} className="sea-qa-dropdown-item-icon" />
            <CustomizeDropdownItemText>{window.gettext('Import records from XLSX')}</CustomizeDropdownItemText>
          </CustomizeDropdownItem>
          <CustomizeDropdownItem className="sea-qa-dropdown-item" onClick={handleTrashClick}>
            <CustomizeDropdownItemIcon symbol={'trash'} className="sea-qa-dropdown-item-icon" />
            <CustomizeDropdownItemText>{BAR_TYPE_CONFIG[BAR_TYPE.KNOWLEDGE_TRASH].name}</CustomizeDropdownItemText>
          </CustomizeDropdownItem>
        </CustomizeDropdownMenu>
      </Dropdown>
      {isShowImportDialog && (
        <ImportDialog onToggle={() => setIsShowImportDialog(false)} onClickBar={onClick} />
      )}
    </>
  );
};

export default KnowledgeMoreNav;
