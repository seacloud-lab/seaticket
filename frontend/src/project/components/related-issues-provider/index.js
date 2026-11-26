import React, { useCallback, useRef, useState } from 'react';
import { RelatedIssuesContext } from '@/project/hooks/related-issues';
import ConnectionRelatedIssuesDialog from '@/project/main-panel/connections/components/related-issues-dialog';
import TicketRelatedIssuesDialog from '@/project/main-panel/tickets/components/related-issues-dialog';

export const useRelatedIssuesWorkflow = ({ projectUuid }) => {
  const [target, setTarget] = useState(null);
  const operationId = useRef(0);

  const openRelatedIssues = useCallback(({ row, connection }) => {
    const rowId = row?._pk ?? row?._id ?? row?.id;
    if (rowId == null || (connection && connection.id == null)) return;
    setTarget({
      operationId: ++operationId.current,
      row: { _id: String(rowId) },
      connectionId: connection?.id,
    });
  }, []);

  const closeDialog = useCallback((targetOperationId) => {
    setTarget(current => current?.operationId === targetOperationId ? null : current);
  }, []);

  return {
    value: { openRelatedIssues },
    dialogs: (
      <>
        {target && (target.connectionId != null ? (
          <ConnectionRelatedIssuesDialog
            key={target.operationId}
            projectUuid={projectUuid}
            row={target.row}
            connectionId={target.connectionId}
            onClose={() => closeDialog(target.operationId)}
          />
        ) : (
          <TicketRelatedIssuesDialog
            key={target.operationId}
            projectUuid={projectUuid}
            ticketId={target.row._id}
            onClose={() => closeDialog(target.operationId)}
          />
        ))}
      </>
    ),
  };
};

export const RelatedIssuesProvider = ({ children, ...props }) => {
  const { value, dialogs } = useRelatedIssuesWorkflow(props);
  return <RelatedIssuesContext.Provider value={value}>{children}{dialogs}</RelatedIssuesContext.Provider>;
};
