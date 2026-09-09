import React, { useContext, useState, useCallback, useRef } from 'react';
import { useData } from '@/project/hooks';
import { CONNECTION_PREDEFINED_COLUMN_NAME } from '@/project/main-panel/connections/constants';
import { useConnections } from '@/project/main-panel/connections/hooks';
import eventBus from '@/utils/event-bus';
import { isFunction } from '@/utils/type-detection';
import { EVENT_BUS_TYPE } from '../../../constants';
import CloseLinkedGitHubIssuesWarningDialog from '../components/close-linked-github-issues-warning-dialog';

const CloseLinkedIssuesContext = React.createContext(null);

export const CloseLinkedIssuesProvider = ({ children }) => {
  const [isShowCloseGitHubIssuesWarningDialog, setIsShowCloseGitHubIssuesWarningDialog] = useState(false);
  const ticketRef = useRef(null);
  const stateReasonRef = useRef(null);
  const closeTicketOnlyCallbackRef = useRef(null);
  const closeTicketAndGitHubIssuesCallbackRef = useRef(null);

  const { connections } = useConnections();
  const { modifyLocalGitHubIssuesClosed } = useData();

  const resetDialogState = useCallback(() => {
    setIsShowCloseGitHubIssuesWarningDialog(false);
    ticketRef.current = null;
    stateReasonRef.current = null;
    closeTicketOnlyCallbackRef.current = null;
    closeTicketAndGitHubIssuesCallbackRef.current = null;
  }, []);

  const openCloseLinkedGitHubIssuesWarningDialog = useCallback(({
    ticket,
    stateReason,
    onCloseTicketOnly,
    onCloseTicketAndGitHubIssues,
  }) => {
    ticketRef.current = ticket;
    stateReasonRef.current = stateReason;
    closeTicketOnlyCallbackRef.current = onCloseTicketOnly;
    closeTicketAndGitHubIssuesCallbackRef.current = onCloseTicketAndGitHubIssues;
    setIsShowCloseGitHubIssuesWarningDialog(true);
  }, []);

  const onToggle = useCallback(() => {
    resetDialogState();
  }, [resetDialogState]);

  const handleSubmit = useCallback((shouldCloseGitHubIssues) => {
    const callback = shouldCloseGitHubIssues ? closeTicketAndGitHubIssuesCallbackRef.current : closeTicketOnlyCallbackRef.current;
    if (!isFunction(callback)) {
      resetDialogState();
      return Promise.resolve({
        data: { success: true }
      });
    }

    return Promise.resolve(callback()).then(res => {
      if (res?.success === false) {
        return res;
      }

      if (shouldCloseGitHubIssues) {
        const pathname = window.location.pathname;

        // update connection table cache
        const issues = ticketRef.current?.open_github_issues || [];
        modifyLocalGitHubIssuesClosed(issues, connections, stateReasonRef.current);

        const record = {
          [CONNECTION_PREDEFINED_COLUMN_NAME.STATE]: 'closed',
          [CONNECTION_PREDEFINED_COLUMN_NAME.STATE_REASON]: stateReasonRef.current,
        };

        // current is connection table, update current view
        const connectionTableReg = /\/connections\/(\d+)\/$/;
        const connectionTableMatch = pathname.match(connectionTableReg);
        if (connectionTableMatch) {
          const connectionId = Number(connectionTableMatch[1]);
          const currentConnectionIssues = issues.filter(issue => issue.connection_id === connectionId);
          if (currentConnectionIssues.length > 0) {
            const idRecordUpdates = currentConnectionIssues.reduce((_update, cur) => {
              const key = cur.record_pk + '';
              _update[key] = record;
              return _update;
            }, {});
            eventBus.dispatch(EVENT_BUS_TYPE.MODIFY_LOCAL_RECORDS, idRecordUpdates);
          }
        }

        // current is connection record details, update record details
        const connectionTableRecordReg = /\/connections\/(\d+)\/records\/(\d+)\/$/;
        const connectionTableRecordMatch = pathname.match(connectionTableRecordReg);
        if (connectionTableRecordMatch) {
          const connectionId = Number(connectionTableRecordMatch[1]);
          const recordId = Number(connectionTableRecordMatch[2]);
          const currentConnectionIssue = issues.find(issue => issue.connection_id === connectionId && issue.record_pk === recordId);
          if (currentConnectionIssue) {
            eventBus.dispatch(EVENT_BUS_TYPE.MODIFY_LOCAL_RECORD, recordId, record);
          }
        }
      }

      resetDialogState();
      return res;
    });
  }, [connections, modifyLocalGitHubIssuesClosed, resetDialogState]);

  return (
    <CloseLinkedIssuesContext.Provider value={{
      openCloseLinkedGitHubIssuesWarningDialog,
    }}>
      {children}
      {isShowCloseGitHubIssuesWarningDialog && (
        <CloseLinkedGitHubIssuesWarningDialog
          ticket={ticketRef.current}
          onToggle={onToggle}
          onCloseTicketOnly={() => handleSubmit(false)}
          onCloseTicketAndGitHubIssues={() => handleSubmit(true)}
        />
      )}
    </CloseLinkedIssuesContext.Provider>
  );
};

export const useCloseLinkedIssues = () => {
  const context = useContext(CloseLinkedIssuesContext);
  if (!context) {
    throw new Error('\'CloseLinkedIssuesContext\' is null');
  }
  return context;
};
