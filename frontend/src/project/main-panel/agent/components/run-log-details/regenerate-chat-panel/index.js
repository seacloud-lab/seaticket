import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import slugid from 'slugid';
import { CommonOperationConfirmationDialog, ResizeBar, toaster } from '@/components';
import { gettext } from '@/constants';
import { agentAPI } from '@/project/api';
import { CHAT_MESSAGE_TYPE } from '@/project/main-panel/ask/constants';
import SidePanelChat from '@/project/main-panel/ask/side-panel-chat';
import { Utils } from '@/utils/utils';
import {
  getLatestDraftMessage,
  hasApplicableChanges,
  markChatReplyApplied,
  markDraftVersionApplied,
} from './utils';

import './index.css';

const { projectUuid, projectName, workspaceID } = window.app.pageOptions;

const MIN_WIDTH = 480;
const MAX_WIDTH = 720;
const WIDTH_STORAGE_KEY = 'project_agent_regenerate_chat_panel_width';

const RegenerateChatPanel = ({ run, onClose, onApplied }) => {
  const [messages, setMessages] = useState([]);
  const [isApplying, setIsApplying] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const ref = useRef(null);
  const chatRef = useRef(null);

  const latestDraftMessage = useMemo(() => getLatestDraftMessage(messages), [messages]);
  const latestDrafts = useMemo(() => latestDraftMessage?.suggestions || [], [latestDraftMessage]);
  const latestRemovedIds = useMemo(
    () => latestDraftMessage?.removedSuggestionIds || [],
    [latestDraftMessage],
  );
  const latestRegenerationReport = latestDraftMessage?.regenerationReport || '';

  const instructionHistory = useMemo(() => (
    messages
      .filter(message => message.role === 'user' && message.text)
      .map(message => message.text)
      .join('\n')
  ), [messages]);

  const hasUnappliedDrafts = useMemo(
    () => hasApplicableChanges(latestDraftMessage),
    [latestDraftMessage],
  );

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

  const handleClose = useCallback(() => {
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
    const appliedVersionId = latestDraftMessage?.versionId;
    if (!hasUnappliedDrafts || !appliedVersionId || isApplying || isReply) return;
    setIsApplying(true);
    onApplied(run.id, {
      instruction: instructionHistory,
      regeneration_report: latestRegenerationReport,
      suggestions: latestDrafts,
      removed_suggestion_ids: latestRemovedIds,
    }).then((result) => {
      if (result?.skipped) return;
      const savedSuggestions = result?.suggestions || latestDrafts;
      toaster.success(gettext('Suggestions updated'));
      setMessages(messages => markDraftVersionApplied(messages, appliedVersionId, savedSuggestions));
      chatRef.current?.setChatHistories(histories => markChatReplyApplied(histories, appliedVersionId, savedSuggestions));
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    }).finally(() => {
      setIsApplying(false);
    });
  }, [hasUnappliedDrafts, instructionHistory, isApplying, latestDraftMessage, latestDrafts, latestRemovedIds, latestRegenerationReport, onApplied, run.id]);

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
      removed_suggestion_ids: latestRemovedIds,
    }).then((res) => {
      const suggestions = res.data?.suggestions || [];
      const removedSuggestionIds = res.data?.removed_suggestion_ids || [];
      const regenerationReport = res.data?.regeneration_report || '';
      const versionId = slugid.nice();
      setMessages(prev => [...prev, {
        role: 'assistant', suggestions, regenerationReport, removedSuggestionIds, versionId,
      }]);
      const emptyText = removedSuggestionIds.length > 0
        ? gettext('Pending suggestions were removed.')
        : gettext('No suggestions were generated.');
      const ai_reply = {
        [CHAT_MESSAGE_TYPE.TEXT]: regenerationReport || (suggestions.length === 0 ? emptyText : ''),
        [CHAT_MESSAGE_TYPE.SUGGESTIONS]: suggestions,
      };
      return {
        data: {
          results: { ai_reply, ai_reply_message_id: versionId }
        }
      };
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setMessages(prev => [...prev, { role: 'assistant', suggestions: [], error: errorMessage }]);
      chatRef.current?.setAsk([instruction]);
      throw error;
    });
  }, [latestDrafts, latestRemovedIds, run]);

  useEffect(() => {
    setMessages([]);
    setIsApplying(false);
    setShowCloseConfirm(false);
  }, [run.id]);

  return (
    <div className="seaqa-agent-regenerate-chat-panel" ref={ref}>
      <SidePanelChat
        innerRef={chatRef}
        row={{ session_uuid: run.id, session_name: gettext('Chat to regenerate'), id: run.id }}
        projectUuid={projectUuid}
        projectName={projectName}
        workspaceID={workspaceID}
        resizable={false}
        readOnly={isApplying}
        emptyTip={gettext('Describe how the suggestions should change.')}
        displayOperations={false}
        showThoughtProcess={false}
        onToggle={handleClose}
        getMessages={getMessages}
        sendMessage={sendMessage}
        placeholder={gettext('Tell the agent how to adjust the suggestions')}
        uploadChatImage={() => {}}
      >
        {({ isReply }) => (
          <div className="seaqa-agent-tool-suggestion-panel-footer">
            <Button color="secondary" onClick={handleClose}>{gettext('Cancel')}</Button>
            <Button
              color="primary"
              onClick={applyDrafts}
              disabled={!hasUnappliedDrafts || isReply || isApplying}
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
