import React, { useEffect, useState, useCallback, useRef } from 'react';
import classnames from 'classnames';
import { DocumentsProvider } from '../hooks';
import { IconButton, CenteredLoading, ResizeBar } from '@/components';
import ChatHistory from '../chat-history';
import { initMessages } from '../utils';

import './index.css';

const INIT_WIDTH = 400;

const Main = ({ projectUuid, projectName, workspaceID, session, onToggle, getMessages }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [chatHistories, setChatHistories] = useState([]);

  const ref = useRef(null);

  const onResize = useCallback((width) => {
    const newWidth = window.innerWidth - width;
    localStorage.setItem('project_side_panel_chat_width', newWidth);
    ref.current.style.width = `${newWidth}px`;
  }, []);

  useEffect(() => {
    const width = parseFloat(localStorage.getItem('project_side_panel_chat_width') || INIT_WIDTH);
    ref.current.style.width = `${width}px`;
  }, []);

  useEffect(() => {
    setIsLoading(true);
    getMessages(projectUuid, session.session_uuid).then(res => {
      const messages = res?.data?.messages || [];
      setChatHistories(initMessages(messages));
    }).finally(() => {
      setIsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectUuid, session.session_uuid]);

  return (
    <div className="seaqa-ai-side-panel-chat seaqa-ai-ask-wrapper s" ref={ref}>
      <div className="seaqa-ai-ask-chats-header">
        <div className="chat-header-title-content">{session.session_name}</div>
        <IconButton icon="close" onClick={onToggle} />
      </div>
      <div className="seaqa-ai-ask-chats-body">
        <div className={classnames('seaqa-ai-ask-chats')}>
          {!isLoading && chatHistories.map((chat, chatIndex) => {
            return (
              <ChatHistory
                key={`chat-${chatIndex}-${chat._id || ''}`}
                chat={chat}
                settings={{}}
                displayOperations={false}
                projectUuid={projectUuid}
                projectName={projectName}
                workspaceID={workspaceID}
              />
            );
          })}
          {isLoading && (<CenteredLoading className="flex-1" />)}
        </div>
      </div>
      <ResizeBar min={window.innerWidth - 480} max={window.innerWidth - 300} onResize={onResize} />
    </div>
  );
};

const SidePanelChat = ({ row: session, ...props }) => {
  return (
    <DocumentsProvider sessionId={session?.id}>
      {session && (<Main session={session} { ...props } />)}
    </DocumentsProvider>
  );
};

export default SidePanelChat;
