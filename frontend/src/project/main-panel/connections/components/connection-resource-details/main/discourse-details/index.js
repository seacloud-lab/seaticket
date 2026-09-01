import React, { useCallback, useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import { gettext } from '@constants';
import { EmptyTip, IconButton, toaster } from '@/components';
import CommonDetailItem from '../common-detail-item';
import ReplyDiscourse from './reply-discourse';
import { connectionsAPI } from '@/project/api';
import { Utils } from '@utils/utils';

import './index.css';

const DiscourseDetails = ({
  details = [],
  className,
  projectUuid,
  connection_id,
  recordId,
  permission,
  handleReplyDiscourseSuccess,
  focus,
}) => {
  const [isShowReply, setIsShowReply] = useState(false);
  const focusRef = useRef(null);

  useEffect(() => {
    if (!focus?.postNumber || !focusRef.current) return;
    focusRef.current.scrollIntoView({ block: 'center' });
  }, [focus?.postNumber]);

  const onSubmit = useCallback(({ content }, callback) => {
    const payload = {
      content,
      _pk: recordId,
    };

    connectionsAPI.replyDiscourseTopic(projectUuid, connection_id, payload)
      .then((res) => {
        // Reset UI state first
        setIsShowReply(false);
        if (handleReplyDiscourseSuccess) {
          handleReplyDiscourseSuccess(res.data);
        }
        callback?.();
      })
      .catch((error) => {
        toaster.danger(Utils.getErrorMsg(error));
        callback?.(true);
      });
  }, [projectUuid, connection_id, recordId, handleReplyDiscourseSuccess]);

  return (
    <div className={classnames('seaqa-connection-discourse-record', className, { 'empty': details.length === 0 })}>
      {details.length === 0 ? (
        <EmptyTip />
      ) : (
        <>
          {details.map((detail, index) => {
            const isFocused = Boolean(focus?.postNumber && detail.post_number != null && String(detail.post_number) === String(focus.postNumber));
            return (
              <div
                key={detail.post_number ?? detail._pk ?? `discourse-${index}`}
                id={detail.post_number != null ? `post-${detail.post_number}` : undefined}
                ref={isFocused ? focusRef : undefined}
                className={classnames({ 'seaqa-connection-detail-focused': isFocused })}
              >
                <CommonDetailItem
                  type="discourse_forum"
                  detail={detail}
                />
              </div>
            );
          })}

          {permission && (
            isShowReply ? (
              <ReplyDiscourse
                onToggle={() => setIsShowReply(false)}
                onSubmit={onSubmit}
              />
            ) : (
              <div className="seaqa-discourse-reply-btn">
                <IconButton
                  icon="reply"
                  text={gettext('Reply')}
                  onClick={() => setIsShowReply(true)}
                />
              </div>
            )
          )}
        </>
      )}
    </div>
  );
};

export default DiscourseDetails;
