import React, { useState } from 'react';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { IconButton } from '@/components';
import { gettext } from '@/constants';
import { CONNECTION_TYPE } from '../../../constants';

import './index.css';

const WEBHOOK_SUPPORTED_TYPES = [CONNECTION_TYPE.DISCOURSE_FORUM];

const OpFormatter = ({ onModify, onDelete, onMore, onManualSync, onViewLog, onConfigureWebhook, row, handleStatusActive, column }) => {
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
      {(onMore || onManualSync || handleStatusActive || onViewLog || onConfigureWebhook) &&
        <Dropdown isOpen={dropdownOpen} toggle={toggle} size="sm">
          <DropdownToggle className="bg-color-deep" tag="span">
            <IconButton className="bg-color-deep" icon="more" onClick={toggle} />
          </DropdownToggle>
          <DropdownMenu className="seaqa-dropdown-menu position-fixed">
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
            {onConfigureWebhook && WEBHOOK_SUPPORTED_TYPES.includes(row.type) && (
              <DropdownItem onClick={() => onConfigureWebhook(row)}>
                {gettext('Webhook setting')}
              </DropdownItem>
            )}
          </DropdownMenu>
        </Dropdown>
      }
    </div>
  );
};

export default OpFormatter;
