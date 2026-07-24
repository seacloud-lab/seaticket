import React, { useMemo } from 'react';
import classnames from 'classnames';
import { getRowById } from '@/sea-metadata/utils/row';
import { useMetadata } from '@/project/hooks';
import PriorityFormatter from '@/sea-metadata/components/cell-formatter/priority';
import { Option, Icon } from '@/components';
import { TICKET_STATE_CONFIG, TICKET_STATE, TICKET } from '@/project/main-panel/tickets/constants';

import './index.css';

const TicketPreview = ({ value }) => {
  const { title, content, priority, type, state } = useMemo(() => {
    try {
      const valueObject = JSON.parse(value);
      return { ...TICKET, ...valueObject };
    } catch {
      return TICKET;
    }
  }, [value]);

  const { typesData } = useMetadata();

  const typeOption = getRowById(typesData, type);
  const stateOption = TICKET_STATE_CONFIG[state];
  const isValidOthersContent = (priority && priority !== 0) || typeOption || stateOption;

  return (
    <div className={classnames('suggestion-content-preview-wrapper suggestion-create-ticket-content-preview-wrapper', {
      'has-others-content': isValidOthersContent
    })}>
      <div className="suggestion-content-preview">
        {title && (<div className="suggestion-create-ticket-preview-title">{title}</div>)}
        <div className="suggestion-create-ticket-preview-content">{content}</div>
      </div>
      {isValidOthersContent && (
        <div className="suggestion-create-ticket-others-preview">
          {priority !== 0 && priority && (<PriorityFormatter value={priority} className="suggestion-create-ticket-priority-preview" />)}
          <div className={classnames('seaqa-project-ticket-status', { 'open': state === TICKET_STATE.OPEN })}>
            <Icon symbol={stateOption?.icon} />
            <span>{stateOption?.statusName}</span>
          </div>
          {typeOption && (<Option option={typeOption} />)}
        </div>
      )}
    </div>
  );
};

export default TicketPreview;
