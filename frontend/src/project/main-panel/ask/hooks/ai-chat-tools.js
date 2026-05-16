import React, { useContext, useState, useCallback, useRef, useEffect } from 'react';
import { chatAPI } from '@/project/api/chat-api';
import { toaster } from '@/components';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';

const AIChatToolsContext = React.createContext(null);

const CHAT_IMAGE_MAX_COUNT = 2;

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const AIChatToolsProvider = ({ projectUuid, children }) => {
  const [attachments, updateAttachments] = useState([]);
  const [pendingImages, setPendingImages] = useState([]);
  const blobUrlsRef = useRef([]);

  const removeAttachment = useCallback((attachment, index) => {
    let newAttachments = attachments.slice(0);
    newAttachments.splice(index, 1);
    updateAttachments(newAttachments);
  }, [attachments]);

  const clearAttachments = useCallback(() => {
    updateAttachments([]);
  }, []);

  const updatePendingImage = useCallback((id, patch) => {
    setPendingImages((prev) => prev.map((img) => (img.id === id ? { ...img, ...patch } : img)));
  }, []);

  const uploadOne = useCallback((id, file) => {
    if (!projectUuid) return;
    chatAPI.uploadChatImage(projectUuid, file, (e) => {
      if (e?.total) {
        updatePendingImage(id, { progress: Math.round((e.loaded / e.total) * 100) });
      }
    }).then((res) => {
      updatePendingImage(id, { status: 'done', tempUrl: res.data.url, progress: 100 });
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
      updatePendingImage(id, { status: 'error', error });
    });
  }, [projectUuid, updatePendingImage]);

  const addImages = useCallback((files) => {
    const arr = Array.from(files || []).filter((f) => f && f.type && f.type.startsWith('image/'));
    if (arr.length === 0) return;

    setPendingImages((prev) => {
      const existingNames = new Set(prev.map((img) => img.name));
      const remain = CHAT_IMAGE_MAX_COUNT - prev.length;
      if (remain <= 0) {
        toaster.danger(gettext('Up to {count} images per message').replace('{count}', CHAT_IMAGE_MAX_COUNT));
        return prev;
      }
      const accepted = [];
      let exceedLimit = false;
      let hasDuplicateName = false;
      for (const file of arr) {
        if (existingNames.has(file.name)) {
          hasDuplicateName = true;
          continue;
        }
        if (accepted.length >= remain) {
          exceedLimit = true;
          break;
        }
        existingNames.add(file.name);
        const item = {
          id: genId(),
          name: file.name,
          file,
          previewUrl: URL.createObjectURL(file),
          status: 'uploading',
          progress: 0,
          tempUrl: null,
        };
        blobUrlsRef.current.push(item.previewUrl);
        accepted.push(item);
      }
      if (hasDuplicateName) {
        toaster.danger(gettext('Images with the same name are not allowed.'));
      }
      if (exceedLimit) {
        toaster.danger(gettext('Up to {count} images per message').replace('{count}', CHAT_IMAGE_MAX_COUNT));
      }
      setTimeout(() => accepted.forEach((it) => uploadOne(it.id, it.file)), 0);
      return [...prev, ...accepted];
    });
  }, [uploadOne]);

  const retryImage = useCallback((id) => {
    setPendingImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (!target) return prev;
      setTimeout(() => uploadOne(id, target.file), 0);
      return prev.map((i) => (i.id === id ? { ...i, status: 'uploading', progress: 0, error: null } : i));
    });
  }, [uploadOne]);

  const removeImage = useCallback((id) => {
    setPendingImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
        blobUrlsRef.current = blobUrlsRef.current.filter((u) => u !== target.previewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const clearImages = useCallback(() => {
    setPendingImages([]);
  }, []);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      blobUrlsRef.current = [];
    };
  }, []);

  return (
    <AIChatToolsContext.Provider value={{
      attachments, updateAttachments, removeAttachment, clearAttachments,
      pendingImages, addImages, removeImage, retryImage, clearImages,
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
