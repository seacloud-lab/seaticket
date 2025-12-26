
import { useState, useCallback } from 'react';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { Icon } from '@/components';
import { Switch } from '@/components';
import { useMetadata } from '@/sea-metadata/hooks';
import { gettext } from '@/constants';

import './manage-setter.css';

const ManageSetter = ({ readOnly, modifyViewLock }) => {
  const [isOpen, setIsOpen] = useState(false);

  const { metadata } = useMetadata();

  const view = metadata?.view;

  const handleLockView = useCallback((e) => {
    const isLocked = e.target.checked;
    modifyViewLock(isLocked);
  }, [view, modifyViewLock]);

  if (readOnly) return null;

  return (
    <Dropdown
      isOpen={isOpen}
      className="sea-metadata-manage-dropdown"
      toggle={(e) => {
        if (e.currentTarget.id === 'lock-view-dropdown-item') return;
        setIsOpen(!isOpen);
      }}
    >
      <DropdownToggle className="dropdown-toggle-button sea-qa-icon-btn mr-2" tag="div">
        <Icon symbol="manage" title={gettext('Manage')} aria-label={gettext('Manage')} />
      </DropdownToggle>
      <DropdownMenu
        className="position-fixed"
        modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]}
      >
        {view && (
          <DropdownItem id='lock-view-dropdown-item' className="sea-metadata-lock-view-item">
            <Switch
              checked={view.is_locked}
              onChange={handleLockView}
              placeholder={gettext('Lock view')}
              size="small"
              textPosition="left"
            />
          </DropdownItem>
        )}
      </DropdownMenu>
    </Dropdown>
  );
};

export default ManageSetter;
