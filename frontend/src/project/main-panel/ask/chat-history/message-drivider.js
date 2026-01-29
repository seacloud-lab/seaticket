import React from 'react';
import './index.css';

const MessageDivider = ({
  text,
  className = '',
  variant = 'default',
  orientation = 'horizontal',
  lineStyle = 'solid',
  textPosition = 'center',
  ...props
}) => {
  const containerClasses = [
    'message-divider',
    variant !== 'default' ? variant : '',
    orientation === 'vertical' ? 'vertical' : '',
    lineStyle === 'dashed' ? 'dashed' : '',
    className
  ].filter(Boolean).join(' ');

  const renderDivider = () => {
    if (textPosition === 'left') {
      return (
        <>
          <span className="message-divider-text">{text}</span>
          <div className="message-divider-line" />
        </>
      );
    } else if (textPosition === 'right') {
      return (
        <>
          <div className="message-divider-line" />
          <span className="message-divider-text">{text}</span>
        </>
      );
    } else {
      // center (default)
      return (
        <>
          <div className="message-divider-line" />
          <span className="message-divider-text">{text}</span>
          <div className="message-divider-line" />
        </>
      );
    }
  };

  return (
    <div className={containerClasses} {...props}>
      {renderDivider()}
    </div>
  );
};

export default MessageDivider;
