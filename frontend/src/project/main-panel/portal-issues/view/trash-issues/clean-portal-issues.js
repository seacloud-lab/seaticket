import React, { useCallback, useEffect, useState } from 'react';
import { gettext } from '@/constants';
import { CommonOperationConfirmationDialog } from '@/components';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '@/project/constants';

const CleanPortalIssues = ({ cleanPortalIssues }) => {
  const [isShowConfirm, setIsShowConfirm] = useState(false);

  const closeConfirm = useCallback(() => {
    setIsShowConfirm(false);
  }, []);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe(EVENT_BUS_TYPE.CLEAN_DELETED_PORTAL_ISSUES, () => setIsShowConfirm(true));
    return () => {
      unsubscribe();
    };
  }, []);

  if (!isShowConfirm) return null;
  return (
    <CommonOperationConfirmationDialog
      title={gettext('Delete portal issues')}
      message={gettext('Are you sure you want to delete the {placeholder} ?').replace('{placeholder}', `<b>${gettext('portal issues')}</b>`)}
      executeOperation={cleanPortalIssues}
      confirmBtnText={gettext('Delete')}
      toggleDialog={closeConfirm}
    />
  );
};

export default CleanPortalIssues;
