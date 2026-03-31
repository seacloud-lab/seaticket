import React, { useCallback } from 'react';
import { IconTooltip } from '@/components';
import { username, gettext } from '@/constants';

import './index.css';

const { isProjectAdmin } = window.app.pageOptions;

const ChatHeader = ({
  session,
  isReply,
  readOnly,
  isEmpty,
  hasHistoryMessages,
  toggleClearContext,
  renderOperation,
  customHeaderTitle,
}) => {
  const isOwner = session?.username === username;
  const disabled = isReply || readOnly;
  const showClearBtn = hasHistoryMessages && (isProjectAdmin || isOwner);
  const operationContent = renderOperation && renderOperation();

  const renderCustomTitle = useCallback(() => {
    const title = isEmpty ? customHeaderTitle : session?.name;
    return <div className="chat-header-title-content" title={title}>{title}</div>;
  }, [session, isEmpty, customHeaderTitle]);

  return (
    <>
      {customHeaderTitle ? renderCustomTitle() : <div className="chat-header-title-content" title={session?.name}>{session?.name}</div>}
      {showClearBtn && (
        <>
          <div className="chat-header-divider"></div>
          <IconTooltip
            disabled={disabled}
            icon="clear"
            hoverBackground={true}
            tip={gettext('Clear context')}
            className="d-flex m-0"
            placement="bottom"
            size={{ btn: 24, icon: 16 }}
            onClick={disabled ? () => {} : toggleClearContext}
          />
        </>
      )}
      {operationContent && (
        <div className="chat-header-operation-wrapper">{operationContent}</div>
      )}
    </>
  );

};

export default ChatHeader;
