import React, { useEffect, useRef } from 'react';
import classnames from 'classnames';
import { EmptyTip } from '@/components';
import { Comment } from '@/project/main-panel/tickets/components';
import { mediaUrl } from '@/constants';
import dayjs from '@/utils/dayjs';

const GitHubIssuesDetails = ({ details, className, isSmallScreen, focus }) => {
  const focusRef = useRef(null);

  useEffect(() => {
    if (!focus?.commentId && !focus?.first) return;
    if (!focusRef.current) return;
    focusRef.current.scrollIntoView({ block: 'center' });
  }, [focus?.commentId, focus?.first]);

  if (details.length === 0) {
    return (
      <div className={classnames('seaqa-connection-email-record empty', className)}>
        <EmptyTip />
      </div>
    );
  }

  return (
    <div className={classnames('seaqa-connection-email-record', className)}>
      {details.map((detail, index) => {
        const comment = {
          creator: {
            name: detail.author,
            avatar_url: `${mediaUrl}avatars/default.png`,
            email: detail.author,
          },
          created_time: detail.created_time ? dayjs(detail.created_time).fromNow() : '',
          content: detail.content,
          comment_id: detail.comment_id,
        };
        const isFocused = Boolean(
          (focus?.first && index === 0) ||
          (focus?.commentId && comment.comment_id && String(comment.comment_id) === String(focus.commentId))
        );

        return (
          <div
            key={comment.comment_id || index}
            id={comment.comment_id ? `comment-${comment.comment_id}` : undefined}
            ref={isFocused ? focusRef : undefined}
            className={classnames({ 'seaqa-connection-detail-focused': isFocused })}
          >
            <Comment
              isSmallScreen={isSmallScreen}
              comment={comment}
              isShowStatus={true}
              readonly={true}
              className="d-none-after"
            />
          </div>
        );
      })}
    </div>
  );
};

export default GitHubIssuesDetails;
