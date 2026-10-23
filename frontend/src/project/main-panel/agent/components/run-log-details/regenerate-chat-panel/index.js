import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import { CommonOperationConfirmationDialog, ResizeBar, toaster } from '@/components';
import { gettext } from '@/constants';
import { agentAPI } from '@/project/api';
import { CHAT_MESSAGE_TYPE } from '@/project/main-panel/ask/constants';
import SidePanelChat from '@/project/main-panel/ask/side-panel-chat';
import { Utils } from '@/utils/utils';

import './index.css';

const { projectUuid, projectName, workspaceID } = window.app.pageOptions;

const MIN_WIDTH = 480;
const MAX_WIDTH = 720;
const WIDTH_STORAGE_KEY = 'project_agent_regenerate_chat_panel_width';

const RegenerateChatPanel = ({
  run,
  onClose,
  onApplied,
  onDraftsChange,
}) => {
  const [messages, setMessages] = useState([]);
  const [isApplying, setIsApplying] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const ref = useRef(null);
  const chatRef = useRef(null);

  const latestDrafts = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === 'assistant' && Array.isArray(message.suggestions) && message.suggestions.length > 0) {
        return message.suggestions;
      }
    }
    return [];
  }, [messages]);

  const instructionHistory = useMemo(() => (
    messages
      .filter(message => message.role === 'user' && message.text)
      .map(message => message.text)
      .join('\n')
  ), [messages]);

  const hasUnappliedDrafts = latestDrafts.length > 0 && !isApplying;

  useEffect(() => {
    onDraftsChange && onDraftsChange(hasUnappliedDrafts);
  }, [hasUnappliedDrafts, onDraftsChange]);

  useEffect(() => {
    const width = parseFloat(localStorage.getItem(WIDTH_STORAGE_KEY) || MIN_WIDTH);
    if (ref.current) {
      ref.current.style.width = `${width < MIN_WIDTH ? MIN_WIDTH : Math.min(width, MAX_WIDTH)}px`;
    }
  }, []);

  const onResize = useCallback((width) => {
    const nextWidth = window.innerWidth - width - 8;
    localStorage.setItem(WIDTH_STORAGE_KEY, nextWidth);
    ref.current.style.width = `${nextWidth}px`;
  }, []);

  const requestClose = useCallback(() => {
    const { isReply } = chatRef.current?.getStatus() || {};
    if (isReply || isApplying) return;
    if (hasUnappliedDrafts) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
  }, [hasUnappliedDrafts, isApplying, onClose]);

  const applyDrafts = useCallback(() => {
    const { isReply } = chatRef.current?.getStatus() || {};
    if (!latestDrafts.length || isApplying || isReply) return;
    setIsApplying(true);
    agentAPI.materializeAgentRun(projectUuid, run.id, {
      instruction: instructionHistory,
      suggestions: latestDrafts,
    }).then((res) => {
      toaster.success(gettext('Suggestions updated'));
      onDraftsChange && onDraftsChange(false);
      onApplied && onApplied(res.data);
      onClose();
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
      setIsApplying(false);
    });
  }, [instructionHistory, isApplying, latestDrafts, onApplied, onClose, onDraftsChange, run.id]);

  const getMessages = useCallback(() => {
    return new Promise((resolve, reject) => {
      resolve({
        data: { messages: [] }
      });
    });
  }, []);

  const sendMessage = useCallback(({ message: instruction }) => {
    setMessages(prev => [...prev, { role: 'user', text: instruction }]);
    return agentAPI.regenerateAgentRun(projectUuid, run.id, {
      instruction,
      previous_drafts: latestDrafts,
    }).then((res) => {
      const suggestions = res.data?.suggestions || [];
      setMessages(prev => [...prev, { role: 'assistant', suggestions }]);
      const ai_reply = suggestions.length === 0 ? gettext('No suggestions were generated.') : {
        [CHAT_MESSAGE_TYPE.SUGGESTIONS]: suggestions,
      };
      return {
        data: {
          results: { ai_reply }
        }
      };
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setMessages(prev => [...prev, { role: 'assistant', suggestions: [], error: errorMessage }]);
      throw error;
    });
  }, [latestDrafts, run]);

  return (
    <div className="seaqa-agent-regenerate-chat-panel" ref={ref}>
      <SidePanelChat
        innerRef={chatRef}
        row={{ session_uuid: run.id, session_name: gettext('Chat to regenerate'), id: run.id }}
        projectUuid={projectUuid}
        projectName={projectName}
        workspaceID={workspaceID}
        resizable={false}
        emptyTip={gettext('Describe how the suggestions should change.')}
        displayOperations={false}
        onToggle={requestClose}
        getMessages={getMessages}
        sendMessage={sendMessage}
        placeholder={gettext('Tell the agent how to adjust the suggestions')}
        uploadChatImage={() => {}}
      >
        {({ isReply }) => (
          <div className="seaqa-agent-tool-suggestion-panel-footer">
            <Button color="secondary" onClick={onClose}>{gettext('Cancel')}</Button>
            <Button
              color="primary"
              onClick={applyDrafts}
              disabled={!latestDrafts.length || isReply || isApplying}
            >
              {isApplying ? gettext('Applying...') : gettext('Apply this version')}
            </Button>
          </div>
        )}
      </SidePanelChat>
      <ResizeBar
        min={window.innerWidth - MAX_WIDTH - 8}
        max={window.innerWidth - MIN_WIDTH - 8}
        onResize={onResize}
        className="position-absolute h-100"
      />
      {showCloseConfirm && (
        <CommonOperationConfirmationDialog
          title={gettext('Discard draft suggestions?')}
          message={gettext('Unapplied suggestions will be lost.')}
          confirmBtnText={gettext('Discard')}
          executeOperation={onClose}
          toggleDialog={() => setShowCloseConfirm(false)}
        />
      )}
    </div>
  );
};

export default RegenerateChatPanel;
