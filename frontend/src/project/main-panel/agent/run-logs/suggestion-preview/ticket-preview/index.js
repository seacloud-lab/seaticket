import React, { useMemo } from 'react';
import classnames from 'classnames';
import { getRowById } from '@/sea-metadata/utils/row';
import { useMetadata } from '@/project/hooks';
import PriorityFormatter from '@/sea-metadata/components/cell-formatter/priority';
import { Option, Icon } from '@/components';
import { TICKET_STATE_CONFIG, TICKET_STATE } from '@/project/main-panel/tickets/constants';
import { appendLinkedRecord } from '@/project/main-panel/connections/utils';

import './index.css';

const initValue = { title: '', content: '', priority: 0, type: '', state: '0001' };

const TicketPreview = ({ value, relatedUrl }) => {
  const { title, content, priority, type, state } = useMemo(() => {
    try {
      const valueObject = JSON.parse(value);
      return { ...initValue, ...valueObject };
    } catch {
      return initValue;
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
        <div className="suggestion-create-ticket-preview-content">{appendLinkedRecord(content, relatedUrl)}</div>
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
