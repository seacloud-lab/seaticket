import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { notificationAPI } from '@/project/api';
import { toaster } from '@/components';
import { Utils } from '@/utils/utils';
import { NOTIFICATION_TYPE } from '@/components/common/notification/constants';

const NotificationContext = createContext();

export const NotificationProvider = ({ children, projectUuid }) => {
  const [showInboxDrawer, setShowInboxDrawer] = useState(false);
  const [notificationList, setNotificationList] = useState([]);
  const [unseen, setUnseen] = useState(0);
  const [allNotificationCount, setAllNotificationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const abortControllerRef = useRef(null);

  const getFormatList = useCallback((res, type) => {
    let list = [];
    if (type === NOTIFICATION_TYPE.GENERAL) {
      list = res.data.general.notification_list || [];
    } else if (type === NOTIFICATION_TYPE.PROJECT) {
      list = res.data.project.project_list.map((item) => {
        return {
          ...item,
          id: item.project_uuid,
          msg_type: 'project_notifications',
        };
      });
    }
    return list;
  }, []);

  const fetchNotifications = useCallback((page = 1, perPage = 20) => {
    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const isFetchMore = page > 1;
    if (isFetchMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    return notificationAPI.listProjectNotifications(projectUuid, page, perPage, { signal: controller.signal })
      .then(res => {
        const list = res.data.notification_list || [];
        const count = res.data.unseen_count || 0;
        if (isFetchMore) {
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

  const fetchAllNotifications = useCallback((page = 1, perPage = 20, type) => {
    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const isFetchMore = page > 1;
    if (isFetchMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    return notificationAPI.listAllNotifications(page, perPage, { signal: controller.signal })
      .then((res) => {
        console.log('res', res, type);
        const list = getFormatList(res, type);
        const count = res.data.general.unseen_count + res.data.project.unseen_count;
        if (isFetchMore) {
          setNotificationList([...notificationList, ...list]);
        } else {
          setNotificationList(list);
          setAllNotificationCount(res.data.count || 0);
          setUnseen(count);
        }
      }).catch((err) => {
        const errorMsg = Utils.getErrorMsg(err);
        toaster.danger(errorMsg);
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [notificationList]);

  const markAsRead = useCallback((noticeId) => {
    const noticeItem = notificationList.find(item => item.id === noticeId);
    if (!noticeItem || noticeItem.seen) return;
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
  }, [notificationList]);

  const markAllAsRead = useCallback(() => {
    const hasUnread = notificationList.find(item => item.seen === false);
    if (notificationList.length === 0 || !hasUnread) return;
    return notificationAPI.markAllProjectRead(projectUuid)
      .then(() => {
        setNotificationList(prev => prev.map(item => ({ ...item, seen: true })));
        setUnseen(0);
      })
      .catch(err => {
        const errorMsg = Utils.getErrorMsg(err);
        toaster.danger(errorMsg);
      });
  }, [projectUuid, notificationList]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [showInboxDrawer]);

  const value = {
    notificationList,
    allNotificationCount,
    unseen,
    loading,
    loadingMore,
    fetchNotifications, // Fetch project
    fetchAllNotifications, // Fetch all
    markAsRead,
    markAllAsRead,
    showInboxDrawer,
    setShowInboxDrawer
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
