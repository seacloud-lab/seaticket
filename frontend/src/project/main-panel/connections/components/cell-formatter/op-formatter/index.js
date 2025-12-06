import React, { useState } from 'react';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { IconButton } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const OpFormatter = ({ onModify, onDelete, onMore, onManualSync, onViewLog, row, handleStatusActive, column }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggle = () => {
    setDropdownOpen(!dropdownOpen);
  };

  return (
    <div className="sea-custom-table-op-formatter">
      {column.width >= 88 && (
        <>
          {onModify && (
            <IconButton className="bg-color-deep mr-1" title={gettext('Edit')} icon="rename" onClick={() => onModify(row)} />
          )}
          {onDelete && (
            <IconButton className="bg-color-deep mr-1" title={gettext('Delete')} icon="delete" onClick={() => onDelete(row)} />
          )}
        </>
      )}
      {(onMore || onManualSync || handleStatusActive || onViewLog) &&
        <Dropdown isOpen={dropdownOpen} toggle={toggle} size="sm">
          <DropdownToggle className="bg-color-deep" tag="span">
            <IconButton className="bg-color-deep" icon="more" onClick={toggle} />
          </DropdownToggle>
          <DropdownMenu className="position-fixed">
            {column.width < 88 && (
              <>
                {onModify && (
                  <DropdownItem onClick={() => onModify(row)} >
                    {gettext('Edit')}
                  </DropdownItem>
                )}
                {onDelete && (
                  <DropdownItem onClick={() => onDelete(row)} >
                    {gettext('Delete')}
                  </DropdownItem>
                )}
              </>
            )}
            {onMore &&
              <DropdownItem onClick={() => onMore(row)}>
                {gettext('Status')}
              </DropdownItem>
            }
            {onViewLog && (
              <DropdownItem onClick={() => onViewLog(row)}>
                {gettext('Logs')}
              </DropdownItem>
            )}
            {onManualSync &&
              <DropdownItem onClick={() => onManualSync(row)}>
                {gettext('Sync now')}
              </DropdownItem>
            }
            {handleStatusActive && (
              <DropdownItem onClick={() => (handleStatusActive(!row.is_active, row))}>
                <span>{row.is_active ? gettext('Deactivate') : gettext('Active')}</span>
              </DropdownItem>
            )}
          </DropdownMenu>
        </Dropdown>
      }
    </div>
  );
};

export default OpFormatter;
