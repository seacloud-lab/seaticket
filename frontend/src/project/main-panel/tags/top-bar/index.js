import React, { useCallback } from 'react';
import TopBar from '../../top-bar';
import { EVENT_BUS_TYPE } from '@/project/constants/event-bus-type';
import { gettext, PERMISSION_TYPES } from '@/constants';
import eventBus from '@/utils/event-bus';
import { AddButton } from '@/project/components';

const TicketTopBar = ({ title, permission }) => {

  const renderLeftChildren = useCallback(() => {
    return (<span className="text-truncate" title={title}>{title}</span>);
  }, []);

  const renderRightChildren = useCallback(() => {
    const isRW = permission === PERMISSION_TYPES.READ_WRITE;
    if (!isRW) return null;
    return (
      <AddButton onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.NEW_TAG)} text={gettext('New tag')} icon="plus" />
    );
  }, [permission]);

  return (
    <TopBar>
      {renderLeftChildren()}
      {renderRightChildren()}
    </TopBar>
  );
};

export default TicketTopBar;
