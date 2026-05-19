import React, { useState } from 'react';
import { Dropdown } from 'reactstrap';
import { IconButton, CustomizeDropdownMoreToggle, CustomizeDropdownMenu, CustomizeDropdownItem } from '@/components';
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
    <div className="seaqa-customize-table-op-formatter">
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
          <CustomizeDropdownMoreToggle isOpen={dropdownOpen} className="bg-color-deep" />
          <CustomizeDropdownMenu fixed={true}>
            {column.width < 88 && (
              <>
                {onModify && (
                  <CustomizeDropdownItem onClick={() => onModify(row)} >
                    {gettext('Edit')}
                  </CustomizeDropdownItem>
                )}
                {onDelete && (
                  <CustomizeDropdownItem onClick={() => onDelete(row)} >
                    {gettext('Delete')}
                  </CustomizeDropdownItem>
                )}
              </>
            )}
            {onMore &&
              <CustomizeDropdownItem onClick={() => onMore(row)}>
                {gettext('Status')}
              </CustomizeDropdownItem>
            }
            {onViewLog && (
              <CustomizeDropdownItem onClick={() => onViewLog(row)}>
                {gettext('Logs')}
              </CustomizeDropdownItem>
            )}
            {onManualSync &&
              <CustomizeDropdownItem onClick={() => onManualSync(row)}>
                {gettext('Sync now')}
              </CustomizeDropdownItem>
            }
            {handleStatusActive && (
              <CustomizeDropdownItem onClick={() => (handleStatusActive(!row.is_active, row))}>
                <span>{row.is_active ? gettext('Deactivate') : gettext('Active')}</span>
              </CustomizeDropdownItem>
            )}
            {onConfigureWebhook && WEBHOOK_SUPPORTED_TYPES.includes(row.type) && (
              <CustomizeDropdownItem onClick={() => onConfigureWebhook(row)}>
                {gettext('Webhook setting')}
              </CustomizeDropdownItem>
            )}
          </CustomizeDropdownMenu>
        </Dropdown>
      }
    </div>
  );
};

export default OpFormatter;
