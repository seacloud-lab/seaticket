import React, { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { CenteredLoading, CustomizeTabs, EmptyTip, IconButton, toaster } from '@/components';
import { gettext } from '@/constants';
import Chat from '../ask/chat';
import { AskPageProvider, DocumentsProvider, SessionsProvider, useAskPage, useSessions } from '../ask/hooks';
import { ASK_PAGE_SLUG_ID } from '../ask/constants';
import { chatAPI } from '@/portal/api/chat-api';
import { useCollaborators } from '@/sea-metadata';
import TopBar from '../top-bar';

import '../ask/index.css';
import './index.css';

const { projectUuid, projectName, workspaceID } = window.app.pageOptions;

const PORTAL_ADMIN_CHAT_PAGE_SIZE = 50;

const adminChatAPI = {
  listChatSessions: (uuid, page, pageSize) => chatAPI.listAdminChatSessions(uuid, page, pageSize),
  getChatMessages: (uuid, sessionUuid) => chatAPI.getAdminChatMessages(uuid, sessionUuid),
};

const TABS = [
  { value: 'all-chat', label: gettext('All chat') },
  { value: 'statistics', label: gettext('Statistics') },
];

const AllChat = () => {
  const { pageSlugId, togglePageSlugId } = useAskPage();
  const { isLoading, sessions, loadMoreSessions } = useSessions();
  const { collaborators } = useCollaborators();
  const selectedSession = sessions.find(session => session._id === pageSlugId);

  const getUserName = (username) => {
    const user = collaborators.find(collaborator => collaborator.email === username);
    return user?.name || username;
  };

  if (isLoading) return <CenteredLoading />;

  return (
    <div className="seaqa-portal-chat-analysis-all-chat">
      <div className="seaqa-portal-chat-analysis-session-list" onScroll={(event) => {
        const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 80) loadMoreSessions();
      }}>
        <table className="seaqa-portal-chat-analysis-session-table">
          <thead>
            <tr>
              <th>{gettext('Title')}</th>
              <th>{gettext('User')}</th>
              <th>{gettext('Input tokens')}</th>
              <th>{gettext('Output tokens')}</th>
              <th>{gettext('Credit used')}</th>
              <th>{gettext('Time')}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(session => (
              <tr
                key={session._id}
                className={session._id === pageSlugId ? 'selected' : ''}
                onClick={() => togglePageSlugId(session._id)}
              >
                <td title={session.name}>{session.name}</td>
                <td title={getUserName(session.username)}>{getUserName(session.username)}</td>
                <td></td>
                <td></td>
                <td></td>
                <td>{dayjs(session.updated_at).format('YYYY-MM-DD HH:mm:ss')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.length === 0 && <EmptyTip text={gettext('No chats')} />}
      </div>
      {pageSlugId && pageSlugId !== ASK_PAGE_SLUG_ID.NEW && (
        <div className="seaqa-portal-chat-analysis-chat-detail">
          <div className="seaqa-portal-chat-analysis-chat-detail-content">
            <div className="seaqa-portal-chat-analysis-chat-detail-header">
              <span className="text-truncate" title={selectedSession?.name}>{selectedSession?.name}</span>
              <IconButton
                icon="close"
                onClick={() => togglePageSlugId(ASK_PAGE_SLUG_ID.NEW)}
                title={gettext('Close')}
                aria-label={gettext('Close')}
              />
            </div>
            <Chat
              sessionId={pageSlugId}
              workspaceID={workspaceID}
              projectUuid={projectUuid}
              projectName={projectName}
              settings={{}}
              api={adminChatAPI}
              canSelectModel={false}
              enableSkills={false}
              readOnly={true}
              hideInput={true}
              hideHeader={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const Statistics = () => {
  const [statistics, setStatistics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    chatAPI.getAdminChatStatistics(projectUuid).then((res) => {
      setStatistics(res.data || {});
    }).catch(() => {
      toaster.danger(gettext('Failed to load statistics'));
    }).finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <CenteredLoading />;

  const items = [
    { key: 'user_count', label: gettext('Users') },
    { key: 'input_tokens', label: gettext('Input tokens') },
    { key: 'output_tokens', label: gettext('Output tokens') },
    { key: 'total_credit_used', label: gettext('Credit used') },
  ];

  return (
    <div className="seaqa-portal-chat-analysis-statistics">
      {items.map(item => (
        <div className="seaqa-portal-chat-analysis-statistics-card" key={item.key}>
          <div className="seaqa-portal-chat-analysis-statistics-label">{item.label}</div>
          <div className="seaqa-portal-chat-analysis-statistics-value">
            {item.key === 'total_credit_used' ? statistics?.[item.key].toFixed(0) : statistics?.[item.key] ?? 0}
          </div>
        </div>
      ))}
    </div>
  );
};

const PortalChatAnalysis = ({ title }) => {
  const [activeTab, setActiveTab] = useState(TABS[0].value);
  const resetURL = useCallback(() => {}, []);
  const getInitialPageSlugId = useCallback(() => ASK_PAGE_SLUG_ID.NEW, []);

  return (
    <>
      <TopBar><span className="text-truncate" title={title}>{title}</span></TopBar>
      <div className="seaqa-portal-chat-analysis-tabs">
        <CustomizeTabs tabs={TABS} value={activeTab} onChange={setActiveTab} />
      </div>
      <AskPageProvider resetURL={resetURL} getInitialPageSlugId={getInitialPageSlugId}>
        <SessionsProvider projectUuid={projectUuid} api={adminChatAPI} paginate pageSize={PORTAL_ADMIN_CHAT_PAGE_SIZE}>
          <DocumentsProvider>
            <div className="seaqa-portal-chat-analysis-content">
              {activeTab === 'all-chat' ? <AllChat /> : <Statistics />}
            </div>
          </DocumentsProvider>
        </SessionsProvider>
      </AskPageProvider>
    </>
  );
};

export default PortalChatAnalysis;
