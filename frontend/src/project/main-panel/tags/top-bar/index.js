import React, { useCallback } from 'react';
import { Button } from 'reactstrap';
import { Icon } from '@/components';
import { gettext, PERMISSION_TYPES } from '@/constants';
import { EVENT_BUS_TYPE } from '@/project/constants/event-bus-type';
import eventBus from '@/utils/event-bus';
import TopBar from '../../top-bar';

const TicketTopBar = ({ title, permission }) => {

  const renderLeftChildren = useCallback(() => {
    return (<span className="text-truncate" title={title}>{title}</span>);
  }, [title]);

  const renderRightChildren = useCallback(() => {
    const isRW = permission === PERMISSION_TYPES.READ_WRITE;
    if (!isRW) return null;
    return (
      <Button color="primary" className="btn-xs" onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.NEW_TAG)}>
        <Icon symbol="tag-stroked" aria-hidden="true" />
        {gettext('New tag')}
      </Button>
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
