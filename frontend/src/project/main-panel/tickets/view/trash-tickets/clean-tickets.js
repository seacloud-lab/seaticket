import React, { useCallback, useEffect, useState } from 'react';
import { gettext } from '@/constants';
import { CommonOperationConfirmationDialog } from '@/components';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '@/project/constants';

const CleanTickets = ({ cleanTickets }) => {
  const [isShowConfirm, setIsShowConfirm] = useState(false);

  const closeConfirm = useCallback(() => {
    setIsShowConfirm(false);
  }, []);

  useEffect(() => {
    const unsubscribeCleanTickets = eventBus.subscribe(EVENT_BUS_TYPE.CLEAN_DELETED_TICKETS, () => setIsShowConfirm(true));
    return () => {
      unsubscribeCleanTickets();
    };
  }, []);

  if (!isShowConfirm) return null;
  return (
    <CommonOperationConfirmationDialog
      title={gettext('Delete tickets')}
      message={gettext('Are you sure you want to delete the {placeholder} ?').replace('{placeholder}', `<b>${gettext('tickets')}</b>`)}
      executeOperation={cleanTickets}
      confirmBtnText={gettext('Delete')}
      toggleDialog={closeConfirm}
    />
  );
};

export default CleanTickets;
