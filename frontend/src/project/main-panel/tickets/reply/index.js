import React from 'react';
import classnames from 'classnames';
import { CustomizeMarkdownViewer } from '../../../../components';
import { gettext } from '../../../../constants';

import './index.css';

const Reply = ({ isShowStatus = false, reply, className, children }) => {
  if (!reply) return null;
  const { creator, created_at, content } = reply;

  return (
    <div className={classnames('sea-qa-project-ticket-reply', className)}>
      <div className="sea-qa-project-ticket-reply-user-avatar">
        <img src={creator.avatar_url} alt={creator.name} />
      </div>
      <div className="sea-qa-project-ticket-reply-container">
        <div className="sea-qa-project-ticket-reply-op">
          {children && children[0] ? children[0] : (
            <>
              <span className="sea-qa-project-ticket-reply-user-name mr-1">{creator.name}</span>
              {isShowStatus && (
                <span className="sea-qa-project-ticket-reply-status mr-1">{gettext('opened')}</span>
              )}
              <span className="sea-qa-project-ticket-reply-time">{created_at}</span>
            </>
          )}
        </div>
        <div className="sea-qa-project-ticket-reply-content">
          {children && children[1] ? children[1] : (
            <CustomizeMarkdownViewer value={content} showTOC={false} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Reply;
