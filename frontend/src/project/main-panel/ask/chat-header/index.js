import React from 'react';
import { useSessions } from '../hooks';
import { SelectorDisplay } from '../components';
import { IconTooltip } from '@/components';
import { username, gettext } from '@/constants';

import './index.css';

const { isProjectAdmin } = window.app.pageOptions;

const ChatHeader = ({
  session,
  isReply,
  readOnly,
  hasHistoryMessages,
  toggleClearContext,
}) => {
  const { openShowSessions } = useSessions();
  const isOwner = session?.username === username;
  const disabled = isReply || readOnly;
  const showClearBtn = hasHistoryMessages && (isProjectAdmin || isOwner);

  return (
    <>
      <SelectorDisplay
        onClick={openShowSessions}
        className="o-hidden chat-header-title-content"
        icon="arrow-down"
        iconPlacement="right"
        border={false}
      >
        {session?.name}
      </SelectorDisplay>
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
    </>
  );

};

export default ChatHeader;
