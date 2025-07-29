import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { gettext, mediaUrl } from '../../../../constants';

function MessageBox({ isUserSpeak, children, time, className }) {

  return (
    <div className={classnames('sea-qa-ai-ask-chat', className, { 'user-input-chat': isUserSpeak })}>
      <div className="sea-qa-ai-ask-chat-header">
        {!isUserSpeak && (
          <>
            <div className="sea-qa-ai-ask-chat-assistant-avatar">
              <img src={`${mediaUrl}img/AI-logo.png`} alt='' width={24} height={24} />
            </div>
            <span className="sea-qa-ai-ask-chat-assistant-name">{gettext('SeaQA AI assistant')}</span>
          </>
        )
        }
        <span className="sea-qa-ai-ask-chat-time">{time}</span>
      </div>
      <div className="sea-qa-ai-ask-chat-main">
        {children}
      </div>
    </div>
  );
}

MessageBox.propTypes = {
  isUserSpeak: PropTypes.bool,
  className: PropTypes.string,
  time: PropTypes.string,
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.string]),
};

export default MessageBox;
