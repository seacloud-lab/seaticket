import React, { useContext, useState, useCallback, useRef } from 'react';
import { isFunction } from '@/utils/type-detection';
import { EVENT_BUS_TYPE } from '../../../constants';
import eventBus from '@/utils/event-bus';
import CloseLinkedGitHubIssuesWarningDialog from '../components/close-linked-github-issues-warning-dialog';
import { useConnections } from '@/project/main-panel/connections/hooks';
import { CONNECTION_PREDEFINED_COLUMN_NAME } from '@/project/main-panel/connections/constants';
import { useData } from '@/project/hooks';

const CloseLinkedIssuesContext = React.createContext(null);

export const CloseLinkedIssuesProvider = ({ children }) => {
  const [isShowCloseGitHubIssuesWarningDialog, setIsShowCloseGitHubIssuesWarningDialog] = useState(false);
  const ticketsRef = useRef(null);
  const stateReasonRef = useRef(null);
  const callbackRef = useRef(null);

  const { connections } = useConnections();
  const { modifyLocalGitHubIssuesClosed } = useData();

  const openCloseLinkedGitHubIssuesWarningDialog = useCallback(({ tickets, stateReason, callback }) => {
    ticketsRef.current = tickets;
    stateReasonRef.current = stateReason;
    callbackRef.current = callback;
    setIsShowCloseGitHubIssuesWarningDialog(true);
  }, []);

  const onToggle = useCallback(() => {
    setIsShowCloseGitHubIssuesWarningDialog(false);
    ticketsRef.current = null;
    stateReasonRef.current = null;
    callbackRef.current = null;
  }, []);

  const onSubmit = useCallback(() => {
    if (!isFunction(callbackRef.current)) {
      return new Promise((resolve, reject) => {
        resolve({
          data: { success: true }
        });
      });
    }
    return callbackRef.current().then(res => {
      setIsShowCloseGitHubIssuesWarningDialog(false);
      const pathname = window.location.pathname;

      // update connection table cache
      const issues = ticketsRef.current.map(ticket => ticket.open_github_issues).flat();
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

      ticketsRef.current = null;
      stateReasonRef.current = null;
      callbackRef.current = null;
      return res;
    });
  }, []);

  return (
    <CloseLinkedIssuesContext.Provider value={{
      openCloseLinkedGitHubIssuesWarningDialog,
    }}>
      {children}
      {isShowCloseGitHubIssuesWarningDialog && (
        <CloseLinkedGitHubIssuesWarningDialog
          tickets={ticketsRef.current}
          onToggle={onToggle}
          onSubmit={onSubmit}
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
