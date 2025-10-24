
import { useState } from 'react';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { Icon } from '@/components';
import { useTagsData } from '@/sea-metadata/hooks';
import { gettext } from '@/constants';
import context from '@/sea-metadata/context';

const ManageSetter = () => {
  const [isOpen, setIsOpen] = useState(false);

  const { toggleAllTags } = useTagsData();
  if (!toggleAllTags || !context.canModify()) return null;

  return (
    <Dropdown
      isOpen={isOpen}
      className="sea-metadata-manage-dropdown"
      toggle={() => setIsOpen(!isOpen)}
    >
      <DropdownToggle className="dropdown-toggle-button sea-qa-icon-btn mr-2" tag="div">
        <Icon symbol="manage" />
      </DropdownToggle>
      <DropdownMenu
        className="position-fixed"
        modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]}
      >
        {toggleAllTags && (<DropdownItem onClick={toggleAllTags}>{gettext('Manage tags')}</DropdownItem>)}
      </DropdownMenu>
    </Dropdown>
  );
};

export default ManageSetter;
