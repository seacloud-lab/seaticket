import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { notificationAPI } from '../../project/api';
import { toaster } from '@/components';
import { Utils } from '@/utils/utils';
import { BAR_TYPE } from '@/project/constants';

const NotificationContext = createContext();

export const NotificationProvider = ({ children, projectUuid, activeBar }) => {
  const [notificationList, setNotificationList] = useState([]);
  const [unseen, setUnseen] = useState(0);
  const [allNotificationCount, setAllNotificationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const firstLoadedRef = useRef(true);
  const abortControllerRef = useRef(null);
  const isActiveInbox = activeBar[0] === BAR_TYPE.INBOX;

  const fetchNotifications = useCallback((page = 1, perPage = 20, isfetchMore) => {
    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (isfetchMore) {
      setLoadingMore(true);
    }

    return notificationAPI.listProjectNotifications(projectUuid, page, perPage, { signal: controller.signal })
      .then(res => {
        const list = res.data.notification_list || [];
        const count = res.data.unseen_count || 0;
        if (isfetchMore) {
          setNotificationList([...notificationList, ...list]);
        } else {
          setNotificationList(list);
          setAllNotificationCount(res.data.count || 0);
          setUnseen(count);
        }
      })
      .catch(err => {
        const errorMsg = Utils.getErrorMsg(err);
        toaster.danger(errorMsg);
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [projectUuid, notificationList]);

  const markAsRead = useCallback((noticeId) => {
    return notificationAPI.markProjectNoticeAsRead(noticeId)
      .then(() => {
        setNotificationList(prev =>
          prev.map(item => item.id === noticeId ? { ...item, seen: true } : item)
        );
        setUnseen(u => Math.max(0, u - 1));
      })
      .catch(err => {
        const errorMsg = Utils.getErrorMsg(err);
        toaster.danger(errorMsg);
      });
  }, []);

  const markAllAsRead = useCallback(() => {
    return notificationAPI.markAllProjectRead(projectUuid)
      .then(() => {
        setNotificationList(prev => prev.map(item => ({ ...item, seen: true })));
        setUnseen(0);
      })
      .catch(err => {
        const errorMsg = Utils.getErrorMsg(err);
        toaster.danger(errorMsg);
      });
  }, [projectUuid]);

  useEffect(() => {
    // Fetch on initial mount and re-fetch when activated
    const shouldFetch = firstLoadedRef.current || isActiveInbox;
    if (!shouldFetch) return;

    if (firstLoadedRef.current) {
      firstLoadedRef.current = false;
    }

    fetchNotifications();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isActiveInbox]);

  const value = {
    notificationList,
    allNotificationCount,
    unseen,
    loading,
    loadingMore,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};
