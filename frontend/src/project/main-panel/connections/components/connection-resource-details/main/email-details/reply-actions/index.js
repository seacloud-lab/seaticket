import React, { useCallback, useState } from 'react';
import { Dropdown, DropdownToggle } from 'reactstrap';
import { CustomizeDropdownItem, CustomizeDropdownMenu, Icon, IconTextBtn } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const stopEvent = (event) => {
  event?.stopPropagation?.();
  event?.nativeEvent?.stopImmediatePropagation?.();
};

const ReplyActions = ({ hasReplyAll, onReply, onReplyAll }) => {
  const [isOpen, setIsOpen] = useState(false);

  // reactstrap also calls this on document-level outside clicks; don't stop those events.
  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleReply = useCallback((event) => {
    stopEvent(event);
    setIsOpen(false);
    onReply(event);
  }, [onReply]);

  const handleReplyAll = useCallback((event) => {
    stopEvent(event);
    setIsOpen(false);
    onReplyAll(event);
  }, [onReplyAll]);

  if (!hasReplyAll) {
    return (
      <IconTextBtn icon="reply" color="default" text={gettext('Reply')} className="h-5" onClick={handleReply} />
    );
  }

  return (
    <Dropdown isOpen={isOpen} toggle={toggle}>
      <div className="seaqa-email-reply-actions" onClick={stopEvent}>
        <IconTextBtn
          icon="reply"
          color="default"
          text={gettext('Reply to all')}
          className="h-5 seaqa-email-reply-actions-main"
          onClick={handleReplyAll}
        />
        <DropdownToggle
          tag="div"
          role="button"
          tabIndex={0}
          className="seaqa-email-reply-menu-toggle"
          title={gettext('More operations')}
          aria-label={gettext('More operations')}
        >
          <Icon symbol="arrow-down-b" />
        </DropdownToggle>
      </div>
      <CustomizeDropdownMenu fixed onClick={stopEvent}>
        <CustomizeDropdownItem toggle={false} onClick={handleReply}>{gettext('Reply')}</CustomizeDropdownItem>
      </CustomizeDropdownMenu>
    </Dropdown>
  );
};

export default ReplyActions;
