import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { RelatedIssuesContext } from '@/project/hooks/related-issues';
import ConnectionRelatedIssuesDialog from '@/project/main-panel/connections/components/related-issues-dialog';
import TicketRelatedIssuesDialog from '@/project/main-panel/tickets/components/related-issues-dialog';

const restoreFocus = ({ trigger, parentDialog }) => {
  if (trigger?.isConnected && (!parentDialog || parentDialog.contains(trigger))) {
    let element = trigger;
    while (element) {
      const style = window.getComputedStyle(element);
      if (element.hidden || element.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden') break;
      element = element.parentElement;
    }
    if (!element) {
      trigger.focus();
      if (document.activeElement === trigger) return;
    }
  }
  if (parentDialog?.isConnected) parentDialog.focus();
};

export const useRelatedIssuesWorkflow = ({ projectUuid }) => {
  const [targets, setTargets] = useState([]);
  const operationId = useRef(0);
  const previousTargets = useRef(targets);

  useLayoutEffect(() => {
    const previous = previousTargets.current;
    previousTargets.current = targets;
    // Restore only after a pop has unmounted the child Modal and its focus handling.
    if (targets.length === previous.length - 1 && targets.every((target, index) => target === previous[index])) {
      restoreFocus(previous[previous.length - 1]);
    }
  }, [targets]);

  const openDialog = useCallback(({ row, connection }, parentOperationId) => {
    const rowId = row?._pk ?? row?._id ?? row?.id;
    if (rowId == null || (connection && connection.id == null)) return;
    const trigger = document.activeElement;
    const dialogs = document.querySelectorAll('[role="dialog"]');
    const target = {
      operationId: ++operationId.current,
      row: { _id: String(rowId) },
      connectionId: connection?.id,
      trigger,
      parentDialog: trigger?.closest('[role="dialog"]') || (parentOperationId != null ? dialogs[dialogs.length - 1] : null),
    };
    setTargets(current => {
      if (parentOperationId == null) return [target];
      if (current[current.length - 1]?.operationId !== parentOperationId) return current;
      return [...current, target];
    });
  }, []);

  const openRelatedIssues = useCallback(params => openDialog(params), [openDialog]);

  const closeDialog = useCallback((targetOperationId) => {
    setTargets(current => current[current.length - 1]?.operationId === targetOperationId ? current.slice(0, -1) : current);
  }, []);

  return {
    value: { openRelatedIssues },
    dialogs: (
      <>
        {targets.map(target => (
          <RelatedIssuesContext.Provider
            key={target.operationId}
            value={{ openRelatedIssues: params => openDialog(params, target.operationId) }}
          >
            {target.connectionId != null ? (
              <ConnectionRelatedIssuesDialog
                projectUuid={projectUuid}
                row={target.row}
                connectionId={target.connectionId}
                onClose={() => closeDialog(target.operationId)}
              />
            ) : (
              <TicketRelatedIssuesDialog
                projectUuid={projectUuid}
                ticketId={target.row._id}
                onClose={() => closeDialog(target.operationId)}
              />
            )}
          </RelatedIssuesContext.Provider>
        ))}
      </>
    ),
  };
};

export const RelatedIssuesProvider = ({ children, ...props }) => {
  const { value, dialogs } = useRelatedIssuesWorkflow(props);
  return <RelatedIssuesContext.Provider value={value}>{children}{dialogs}</RelatedIssuesContext.Provider>;
};
