import React, { useCallback, useEffect, useState } from 'react';
import { CenteredLoading, CustomizeTabs, toaster } from '@/components';
import { gettext } from '@/constants';
import Sessions from '../ask/sessions';
import Chat from '../ask/chat';
import { AskPageProvider, DocumentsProvider, SessionsProvider, useAskPage, useSessions } from '../ask/hooks';
import { ASK_PAGE_SLUG_ID } from '../ask/constants';
import { chatAPI } from '@/portal/api/chat-api';
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

  useEffect(() => {
    if (!isLoading && pageSlugId === ASK_PAGE_SLUG_ID.NEW && sessions[0]) {
      togglePageSlugId(sessions[0]._id);
    }
  }, [isLoading, pageSlugId, sessions, togglePageSlugId]);

  if (isLoading) return <CenteredLoading />;

  return (
    <div className="seaqa-portal-chat-analysis-all-chat">
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
      />
      <Sessions sessionId={pageSlugId} permission="r" onLoadMore={loadMoreSessions} />
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
