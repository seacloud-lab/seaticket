import React, { useCallback } from 'react';
import TopBar from '../../top-bar';
import { EVENT_BUS_TYPE } from '@/project/constants/event-bus-type';
import { gettext, PERMISSION_TYPES } from '@/constants';
import eventBus from '@/utils/event-bus';
import { IconTextBtn } from '@/components';

const TicketTopBar = ({ title, permission }) => {

  const renderLeftChildren = useCallback(() => {
    return (<span className="text-truncate" title={title}>{title}</span>);
  }, [title]);

  const renderRightChildren = useCallback(() => {
    const isRW = permission === PERMISSION_TYPES.READ_WRITE;
    if (!isRW) return null;
    return (
      <IconTextBtn onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.NEW_TAG)} text={gettext('New tag')} icon="tag-stroked" />
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
