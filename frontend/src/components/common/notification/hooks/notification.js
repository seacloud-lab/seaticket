import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { toaster } from '@/components';
import { siteRoot, username } from '@/constants';
import { notificationAPI } from '@/project/api';
import BrowserMessenger from '@/utils/browser-messenger';
import { Utils } from '@/utils/utils';
import sharedWsClient from '@/utils/websocket-service';
import {
  NOTIFICATION_TYPE, TICKET_MSG_TYPES, MSG_TYPE_PROJECTS, MSG_TYPE_WS_USER_NOTIFICATION,
  MSG_TYPE_WS_USER_LOGOUT_NOTIFICATION,
} from '../constants';

const NotificationContext = createContext();

export const NotificationProvider = ({ children, projectUuid }) => {
  const [showInboxDrawer, setShowInboxDrawer] = useState(false);
  const [notificationList, setNotificationList] = useState([]);
  const [unseen, setUnseen] = useState(0);
  const [unseenByType, setUnseenByType] = useState({
    [NOTIFICATION_TYPE.GENERAL]: 0,
    [NOTIFICATION_TYPE.PROJECT]: 0,
  });
  const [allNotificationCount, setAllNotificationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const browserMessenger = useMemo(() => new BrowserMessenger(), []);

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
          msg_type: MSG_TYPE_PROJECTS,
        };
      });
    }
    return list;
  }, []);

  const fetchNotifications = useCallback((page = 1, perPage = 50) => {
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
        if (errorMsg !== 'canceled') {
          toaster.danger(errorMsg);
        }
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
        const generalUnseenCount = res.data.general.unseen_count || 0;
        const projectUnseenCount = res.data.project.unseen_count || 0;
        const count = generalUnseenCount + projectUnseenCount;
        setUnseenByType({
          [NOTIFICATION_TYPE.GENERAL]: generalUnseenCount,
          [NOTIFICATION_TYPE.PROJECT]: projectUnseenCount,
        });
        // First load
        if (!type) {
          setUnseen(count);
          return;
        }

        const list = getFormatList(res, type);
        if (isFetchMore) {
          setNotificationList((prev) => [...prev, ...list]);
        } else {
          setNotificationList(list);
          const allCount = (type === NOTIFICATION_TYPE.PROJECT ? res.data.project.count : res.data.general.count);
          setAllNotificationCount(allCount || 0);
          setUnseen(count);
        }
      })
      .catch((err) => {
        const errorMsg = Utils.getErrorMsg(err);
        if (errorMsg !== 'canceled' && err?.name !== 'AbortError') {
          toaster.danger(errorMsg);
        }
      })
      .finally(() => {
        if (abortControllerRef.current !== controller) return;
        setLoading(false);
        setLoadingMore(false);
      });
  }, [getFormatList]);

  const markAsRead = useCallback((noticeId) => {
    const noticeItem = notificationList.find(item => item.id === noticeId);
    if (!noticeItem || noticeItem.seen) return;
    return notificationAPI.markProjectNoticeAsRead(noticeId)
      .then(() => {
        setNotificationList(prev =>
          prev.map(item => item.id === noticeId ? { ...item, seen: true } : item)
        );
        setUnseen(u => {
          const newValue = Math.max(0, u - 1);
          browserMessenger.send({
            type: username,
            projectUuid,
            unseen: newValue,
            seen: 1,
          });
          return newValue;
        });
      })
      .catch(err => {
        const errorMsg = Utils.getErrorMsg(err);
        toaster.danger(errorMsg);
      });
  }, [notificationList, projectUuid, browserMessenger]);

  const markAllAsRead = useCallback(() => {
    const hasUnread = notificationList.find(item => item.seen === false);
    if (notificationList.length === 0 || !hasUnread) return;
    return notificationAPI.markAllProjectRead(projectUuid)
      .then(() => {
        setNotificationList(prev => prev.map(item => ({ ...item, seen: true })));
        setUnseen(0);
        browserMessenger.send({
          type: username,
          projectUuid,
          unseen: 0,
          seen: unseen,
        });
      })
      .catch(err => {
        const errorMsg = Utils.getErrorMsg(err);
        toaster.danger(errorMsg);
      });
  }, [unseen, projectUuid, notificationList, browserMessenger]);

  const markProjectNoticeAsReadByTicket = useCallback((projectUuid, ticketId) => {
    if (unseen === 0) return;
    if (!notificationList.find(notification => !notification.seen && TICKET_MSG_TYPES.includes(notification.msg_type) && notification.detail.ticket_id === ticketId)) return;
    notificationAPI.markProjectNoticeAsReadByTicket(projectUuid, ticketId).then(res => {
      const { seen_count = 0 } = res.data;
      const newNotificationList = notificationList.map(notification => {
        if (!notification.seen && TICKET_MSG_TYPES.includes(notification.msg_type) && notification.detail.ticket_id === ticketId) return { ...notification, seen: true };
        return notification;
      });
      setNotificationList(newNotificationList);
      setUnseen(u => {
        const newValue = Math.max(u - seen_count, 0);
        browserMessenger.send({
          type: username,
          projectUuid,
          unseen: newValue,
          seen: seen_count,
        });
        return newValue;
      });
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [unseen, notificationList, browserMessenger]);

  // used for all notifications
  const markAsReadByTab = useCallback((noticeItem, curTab) => {
    if (curTab === NOTIFICATION_TYPE.GENERAL) {
      const notice = notificationList.find(item => item.id === noticeItem.id);
      if (!notice || notice.seen) return;
      return notificationAPI.markNoticeAsRead(notice.id)
        .then(() => {
          setNotificationList(prev =>
            prev.map(item => item.id === notice.id ? { ...item, seen: true } : item)
          );
          setUnseen(u => Math.max(0, u - 1));
          setUnseenByType(prev => ({
            ...prev,
            [NOTIFICATION_TYPE.GENERAL]: Math.max(0, prev[NOTIFICATION_TYPE.GENERAL] - 1),
          }));
        })
        .catch(err => {
          const errorMsg = Utils.getErrorMsg(err);
          toaster.danger(errorMsg);
        });
    } else if (curTab === NOTIFICATION_TYPE.PROJECT) {
      const projectName = noticeItem.project_name || noticeItem.name || '';
      const projectHref = siteRoot + 'workspace/' + noticeItem.workspace_id + '/project/' + encodeURIComponent(projectName) + '/tickets/?view=open&show_inbox=open';
      window.open(projectHref, '_blank');
    }
  }, [notificationList]);

  const markAllAsReadByTab = useCallback((curTab) => {
    if (curTab === NOTIFICATION_TYPE.GENERAL) {
      const unSeenList = notificationList.filter(item => !item.seen);
      if (unSeenList.length === 0) return;

      notificationAPI.markAllRead()
        .then(() => {
          setUnseen(unseen - unSeenList.length);
          setNotificationList(prev => prev.map(item => ({ ...item, seen: true })));
          setUnseenByType(prev => ({
            ...prev,
            [NOTIFICATION_TYPE.GENERAL]: Math.max(0, prev[NOTIFICATION_TYPE.GENERAL] - unSeenList.length),
          }));
        })
        .catch(err => {
          const errorMsg = Utils.getErrorMsg(err);
          toaster.danger(errorMsg);
        });
    } else if (curTab === NOTIFICATION_TYPE.PROJECT) {
      const unSeenList = notificationList.filter(item => item.unseen_count > 0);
      if (unSeenList.length === 0) return;

      const count = unSeenList.reduce((sum, item) => sum + item.unseen_count, 0);
      Promise.all(unSeenList.map(item => notificationAPI.markAllProjectRead(item.project_uuid)))
        .then(() => {
          unSeenList.forEach((item) => {
            browserMessenger.send({
              type: item.project_uuid,
              unseen: 0,
              seen: item.unseen_count
            });
          });
          setUnseen(Math.max(0, unseen - count));
          setNotificationList([]);
          setUnseenByType(prev => ({
            ...prev,
            [NOTIFICATION_TYPE.PROJECT]: Math.max(0, prev[NOTIFICATION_TYPE.PROJECT] - count),
          }));
        })
        .catch(err => {
          const errorMsg = Utils.getErrorMsg(err);
          toaster.danger(errorMsg);
        });
    }
  }, [notificationList, unseen, browserMessenger]);

  useEffect(() => {
    // When clicking on the project notification, open the inbox drawer
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('show_inbox') === 'open') {
      setShowInboxDrawer(true);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // websocket messages
  useEffect(() => {
    if (projectUuid) return;

    const handleNotice = (notice) => {
      if (!notice) return;
      const noticeType = notice.type;
      const notificationContent = notice.content || {};
      const noticeProjectUuid = notificationContent.project_uuid;
      if (noticeType === MSG_TYPE_WS_USER_NOTIFICATION) {
        setUnseen(prev => prev + 1);
        const updateKey = noticeProjectUuid ? NOTIFICATION_TYPE.PROJECT : NOTIFICATION_TYPE.GENERAL;
        setUnseenByType(prev => ({ ...prev, [updateKey]: prev[updateKey] + 1 }));
        setNotificationList((notifications) => {
          if (noticeProjectUuid) {
            const noticeProjectUuidIndex = notifications.findIndex(notification => notification.project_uuid === noticeProjectUuid);
            if (noticeProjectUuidIndex === -1) {
              const newNotification = { ...notificationContent, id: noticeProjectUuid, count: 1, unseen_count: 1, msg_type: MSG_TYPE_PROJECTS };
              return [newNotification, ...notifications];
            }
            let newNotifications = notifications.slice(0);
            const notification = newNotifications[noticeProjectUuidIndex];
            newNotifications[noticeProjectUuidIndex] = { ...notification, count: notification.count + 1, unseen_count: notification.unseen_count + 1 };
            return newNotifications;
          }
          const newNotification = { ...notificationContent, seen: false };
          return [newNotification, ...notifications];
        });
        return;
      }

      if (noticeType === MSG_TYPE_WS_USER_LOGOUT_NOTIFICATION && notice?.content?.session_id) {
        sharedWsClient.close();
        return;
      }
    };

    sharedWsClient.addMessageListener(handleNotice);

    return () => {
      sharedWsClient.removeMessageListener(handleNotice);
    };
  }, [projectUuid]);

  // browser messages
  useEffect(() => {
    if (!browserMessenger) return;
    if (projectUuid) {
      browserMessenger.on(projectUuid, (data) => {
        const { unseen } = data;
        setUnseen(unseen);
        setNotificationList(prev => prev.map(item => ({ ...item, seen: true })));
      });
      return () => {
        browserMessenger.off(projectUuid);
        browserMessenger.close();
      };
    }

    browserMessenger.on(username, (data) => {
      const { projectUuid, unseen, seen } = data;
      setUnseen(u => Math.max(u - seen, 0));
      setUnseenByType(prev => ({ ...prev, [NOTIFICATION_TYPE.PROJECT]: Math.max(prev[NOTIFICATION_TYPE.PROJECT] - seen, 0) }));
      setNotificationList((notifications) => {
        if (projectUuid) {
          const noticeProjectUuidIndex = notifications.findIndex(notification => notification.project_uuid === projectUuid);
          if (noticeProjectUuidIndex === -1) return notifications;
          let newNotifications = notifications.slice(0);
          if (unseen === 0) {
            newNotifications.splice(noticeProjectUuidIndex, 1);
          } else {
            const notification = newNotifications[noticeProjectUuidIndex];
            newNotifications[noticeProjectUuidIndex] = { ...notification, count: notification.count, unseen_count: unseen };
          }
          return newNotifications;
        }
        return notifications;
      });
    });
    return () => {
      browserMessenger.off(username);
      browserMessenger.close();
    };

  }, [browserMessenger, projectUuid]);

  return (
    <NotificationContext.Provider value={{
      notificationList,
      setNotificationList,
      allNotificationCount,
      setAllNotificationCount,
      unseen,
      unseenByType,
      loading,
      loadingMore,
      fetchNotifications, // Fetch project
      fetchAllNotifications, // Fetch all
      markAsRead,
      markAllAsRead,
      markAsReadByTab,
      markProjectNoticeAsReadByTicket,
      markAllAsReadByTab,
      showInboxDrawer,
      setShowInboxDrawer,
    }}>
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
