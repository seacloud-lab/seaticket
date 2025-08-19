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
      {onManualCrawl && isSite &&
        (<IconButton className="bg-color-deep" title={gettext('Crawl now')} icon="search" onClick={() => onManualCrawl(row)} />)
      }
      {onDelete &&
        <IconButton className="bg-color-deep mr-1" title={gettext('Delete')} icon="delete" onClick={() => onDelete(row)} />
      }

      {showStatus &&
        <Dropdown isOpen={dropdownOpen} toggle={toggle} size="sm">
          <DropdownToggle className="bg-color-deep" tag="span">
            <IconButton className="bg-color-deep" icon="more" onClick={toggle} />
          </DropdownToggle>
          <DropdownMenu>
            <DropdownItem onClick={() => showStatus(row)}>
              {gettext('Status')}
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      }
    </div>
  );
};

export default OpFormatter;
