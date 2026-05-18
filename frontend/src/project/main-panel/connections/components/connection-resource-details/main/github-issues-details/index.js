import React from 'react';
import classnames from 'classnames';
import { EmptyTip } from '@/components';
import { Comment } from '@/project/main-panel/tickets/components';
import { mediaUrl } from '@/constants';
import dayjs from '@/utils/dayjs';

const GitHubIssuesDetails = ({ details, className, isSmallScreen }) => {

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

        return (
          <Comment
            key={comment.comment_id || index}
            isSmallScreen={isSmallScreen}
            comment={comment}
            isShowStatus={true}
            readonly={true}
            className="d-none-after"
          />
        );
      })}
    </div>
  );
};

export default GitHubIssuesDetails;
