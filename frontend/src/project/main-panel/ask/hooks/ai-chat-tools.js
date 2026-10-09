import React, { useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { siteRoot } from '@/constants';
import { BAR_TYPE } from '@/project/constants';
import BrowserMessenger from '@/utils/browser-messenger';
import { AttachmentObject } from '../models';

const AIChatToolsContext = React.createContext(null);
const AI_CHAT_ATTACHMENT_CHANNEL_NAME_PARAM = 'ai_chat_attachment_channel_name';
const AI_CHAT_ATTACHMENT_CHANNEL_NAME_PREFIX = 'seaqa_ai_chat_attachments_';
const AI_CHAT_ATTACHMENT_MESSAGE = {
  REQUEST: 'ai_chat_attachment_transfer_request',
  ATTACHMENTS: 'ai_chat_attachment_transfer_attachments',
  ACK: 'ai_chat_attachment_transfer_ack',
};

const getAttachmentChannelName = () => {
  return new URLSearchParams(window.location.search).get(AI_CHAT_ATTACHMENT_CHANNEL_NAME_PARAM);
};

const serializeAttachments = (attachments) => {
  return attachments.map(({ to_json, ...attachment }) => attachment);
};

export const AIChatToolsProvider = ({ projectUuid, workspaceID, projectName, children }) => {
  const [attachments, updateAttachments] = useState([]);
  const [attachmentChannelName] = useState(getAttachmentChannelName);

  const attachmentChannelMessenger = useMemo(() => {
    if (!attachmentChannelName) return null;
    return new BrowserMessenger(attachmentChannelName, { enableHeartbeat: false });
  }, [attachmentChannelName]);

  const pendingAttachmentChannelsRef = useRef(new Map());

  const removeAttachment = useCallback((attachment, index) => {
    let newAttachments = attachments.slice(0);
    newAttachments.splice(index, 1);
    updateAttachments(newAttachments);
  }, [attachments]);

  const clearAttachments = useCallback(() => {
    updateAttachments([]);
  }, []);

  const handleResolveAttachmentsByAI = useCallback((sourceAttachments = []) => {
    if (!Array.isArray(sourceAttachments) || sourceAttachments.length === 0) return;
    const validAttachments = sourceAttachments.map(attachment => new AttachmentObject(attachment));
    const channelName = `${AI_CHAT_ATTACHMENT_CHANNEL_NAME_PREFIX}${projectUuid}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const messenger = new BrowserMessenger(channelName, { enableHeartbeat: false });
    const chatUrl = new URL(`${siteRoot}workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.CHAT}/`, window.location.origin);
    chatUrl.searchParams.set(AI_CHAT_ATTACHMENT_CHANNEL_NAME_PARAM, channelName);

    let targetTabId = null;
    const closeAttachmentChannel = () => {
      messenger.off(AI_CHAT_ATTACHMENT_MESSAGE.REQUEST, handleSendAttachments);
      messenger.off(AI_CHAT_ATTACHMENT_MESSAGE.ACK, handleAcceptAttachmentsSuccess);
      messenger.close();
      pendingAttachmentChannelsRef.current.delete(channelName);
    };
    const handleSendAttachments = (data, event) => {
      const sourceTabId = event?.data?._meta?.fromTabId;
      if (!sourceTabId) return;
      targetTabId = sourceTabId;
      messenger.send({
        type: AI_CHAT_ATTACHMENT_MESSAGE.ATTACHMENTS,
        attachments: serializeAttachments(validAttachments),
      }, { targetTabId });
    };
    const handleAcceptAttachmentsSuccess = (data, event) => {
      const sourceTabId = event?.data?._meta?.fromTabId;
      if (sourceTabId !== targetTabId) return;
      closeAttachmentChannel();
    };

    messenger.on(AI_CHAT_ATTACHMENT_MESSAGE.REQUEST, handleSendAttachments);
    messenger.on(AI_CHAT_ATTACHMENT_MESSAGE.ACK, handleAcceptAttachmentsSuccess);
    pendingAttachmentChannelsRef.current.set(channelName, { messenger });
    window.open(chatUrl.href, '_blank', 'noopener,noreferrer');
  }, [projectUuid, workspaceID, projectName]);

  useEffect(() => {
    if (!attachmentChannelMessenger) return;

    const handleAcceptAttachments = (data, event) => {
      if (!Array.isArray(data?.attachments)) return;
      updateAttachments(data.attachments.map(attachment => new AttachmentObject(attachment)));
      const sourceTabId = event?.data?._meta?.fromTabId;
      if (sourceTabId) {
        attachmentChannelMessenger.send({ type: AI_CHAT_ATTACHMENT_MESSAGE.ACK }, { targetTabId: sourceTabId });
      }
    };

    attachmentChannelMessenger.on(AI_CHAT_ATTACHMENT_MESSAGE.ATTACHMENTS, handleAcceptAttachments);
    attachmentChannelMessenger.send({ type: AI_CHAT_ATTACHMENT_MESSAGE.REQUEST });

    return () => {
      attachmentChannelMessenger.off(AI_CHAT_ATTACHMENT_MESSAGE.ATTACHMENTS, handleAcceptAttachments);
      attachmentChannelMessenger.close();
    };
  }, [attachmentChannelMessenger]);

  useEffect(() => {
    const pendingAttachmentChannels = pendingAttachmentChannelsRef.current;
    return () => {
      pendingAttachmentChannels.forEach(({ messenger }) => messenger.close());
      pendingAttachmentChannels.clear();
    };
  }, []);

  return (
    <AIChatToolsContext.Provider value={{
      attachments, updateAttachments, removeAttachment, clearAttachments,
      handleResolveAttachmentsByAI,
    }}>
      {children}
    </AIChatToolsContext.Provider>
  );
};

export const useAIChatTools = () => {
  const context = useContext(AIChatToolsContext);
  if (!context) {
    throw new Error('\'ChatToolsContext\' is null');
  }
  return context;
};
