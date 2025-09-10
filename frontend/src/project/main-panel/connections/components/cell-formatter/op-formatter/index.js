import React, { useState } from 'react';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { IconButton, Icon } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const OpFormatter = ({ onModify, onDelete, onMore, onManualSync, row, handleStatusActive }) => {

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggle = () => {
    setDropdownOpen(!dropdownOpen);
  };

  return (
    <div className="sea-custom-table-op-formatter">
      {onModify &&
        <IconButton className="bg-color-deep mr-1" title={gettext('Edit')} icon="rename" onClick={() => onModify(row)} />
      }
      {onDelete &&
        <IconButton className="bg-color-deep mr-1" title={gettext('Delete')} icon="delete" onClick={() => onDelete(row)} />
      }
      {(onMore || onManualSync) &&
        <Dropdown isOpen={dropdownOpen} toggle={toggle} size="sm">
          <DropdownToggle className="bg-color-deep" tag="span">
            <IconButton className="bg-color-deep" icon="more" onClick={toggle} />
          </DropdownToggle>
          <DropdownMenu>
            {onMore &&
              (
                <DropdownItem onClick={() => onMore(row)}>
                  {gettext('Status')}
                </DropdownItem>
              )
            }
            {onManualSync &&
              (
                <DropdownItem onClick={() => onManualSync(row)}>
                  {gettext('Sync now')}
                </DropdownItem>
              )
            }
            {handleStatusActive && (
              <>
                <DropdownItem onClick={() => (handleStatusActive(true, row))}>
                  {gettext('Active')}
                  {row.is_active && <Icon symbol="check" className="sea-qa-role-status-check ml-2" />}
                </DropdownItem>
                <DropdownItem onClick={() => (handleStatusActive(false, row))}>
                  {gettext('Inactive')}
                  {!row.is_active && <Icon symbol="check" className="sea-qa-role-status-check ml-2" />}
                </DropdownItem>
              </>
            )}
          </DropdownMenu>
        </Dropdown>
      }
    </div>
  );
};

export default OpFormatter;
