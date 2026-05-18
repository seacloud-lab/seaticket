import React, { useState } from 'react';
import classnames from 'classnames';
import { Dropdown, DropdownToggle } from 'reactstrap';
import { CustomizeLabel, CustomizeDropdownMenu, CustomizeDropdownItem } from '@/components';
import { gettext } from '@/constants';
import { ResourceDetailsDialog } from '@/project/components';
import { TICKET_TYPE } from '@/project/main-panel/tickets/constants';

import './index.css';

const LinkedTicket = ({
  projectUuid,
  ticketID,
  title,
  className,
  isReadonly,
  linkedTicketTools,
  getTicket,
}) => {
  const [isShowTicketInDialog, setIsShowTicketInDialog] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const isValid = ticketID && title;

  return (
    <div className={classnames('sea-ticket-settings-item', className)}>
      <CustomizeLabel icon="link">{gettext('Linked ticket')}</CustomizeLabel>
      <div className={classnames('sea-ticket-link-settings-formatter', { 'valid': isValid })}>
        {isValid ? (
          <div className="link-item">
            <span className="link-item-name" title={title} onClick={() => setIsShowTicketInDialog(true)}>{title}</span>
          </div>
        ) : (
          <>
            {!isReadonly && Array.isArray(linkedTicketTools) && linkedTicketTools.length > 0 ? (
              <>
                <Dropdown isOpen={isMoreMenuOpen} toggle={() => setIsMoreMenuOpen(!isMoreMenuOpen)}>
                  <DropdownToggle
                    tag="div"
                    role="button"
                    className="cursor-pointer seaqa-tip-default"
                    title={gettext('Create related ticket or link an existing ticket')}
                    aria-label={gettext('Create related ticket or link an existing ticket')}
                    data-toggle="dropdown"
                    aria-expanded={isMoreMenuOpen}
                    isOpen={isMoreMenuOpen}
                  >
                    {gettext('No linked ticket')}
                  </DropdownToggle>
                  <CustomizeDropdownMenu className="position-fixed">
                    {linkedTicketTools.map((tool) => {
                      return (
                        <CustomizeDropdownItem
                          key={tool.key}
                          onClick={() => {
                            tool.callback && tool.callback();
                            setIsMoreMenuOpen(false);
                          }}
                        >
                          {tool.label}
                        </CustomizeDropdownItem>
                      );
                    })}
                  </CustomizeDropdownMenu>
                </Dropdown>
              </>
            ) : (
              <div className="seaqa-tip-default">{gettext('No linked ticket')}</div>
            )}
          </>
        )}
      </div>
      {isShowTicketInDialog && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={{ type: TICKET_TYPE, title, _id: ticketID }}
          onToggle={() => setIsShowTicketInDialog(false)}
          getTicket={getTicket}
        />
      )}
    </div>
  );
};

export default LinkedTicket;
