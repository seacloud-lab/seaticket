import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

function MessageBox({ isUserSpeak, children, className }) {

  return (
    <div className={classnames('seaqa-ai-ask-chat', className, { 'user-input-chat': isUserSpeak })}>
      {children}
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
