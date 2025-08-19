import React, { useState } from 'react';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { IconButton } from '../../../../../components';
import { gettext } from '../../../../../constants';

import './index.css';

const OpFormatter = ({ onModify, onDelete, showStatus, onManualCrawl, row }) => {

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggle = () => {
    setDropdownOpen(!dropdownOpen);
  };
  const isSite = row?.type === 'site';

  return (
    <div className="sea-custom-table-op-formatter">
      {onModify &&
        <IconButton className="bg-color-deep mr-1" title={gettext('Edit')} icon="rename" onClick={() => onModify(row)} />
      }
      {onDelete &&
        <IconButton className="bg-color-deep mr-1" title={gettext('Delete')} icon="delete" onClick={() => onDelete(row)} />
      }

      {(showStatus || onManualCrawl) &&
        <Dropdown isOpen={dropdownOpen} toggle={toggle} size="sm">
          <DropdownToggle className="bg-color-deep" tag="span">
            <IconButton className="bg-color-deep" icon="more" onClick={toggle} />
          </DropdownToggle>
          <DropdownMenu>
            {showStatus &&
              (
                <DropdownItem onClick={() => showStatus(row)}>
                  {gettext('Status')}
                </DropdownItem>
              )
            }
            {onManualCrawl && isSite &&
              (
                <DropdownItem onClick={() => onManualCrawl(row)}>
                  {gettext('Sync now')}
                </DropdownItem>
              )
            }
          </DropdownMenu>
        </Dropdown>
      }
    </div>
  );
};

export default OpFormatter;
