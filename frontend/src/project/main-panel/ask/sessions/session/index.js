import { useCallback, useState } from 'react';
import classnames from 'classnames';
import { Dropdown } from 'reactstrap';
import {
  CustomizeDropdownMoreToggle, CustomizeNameDialog, CommonOperationConfirmationDialog,
  CustomizeDropdownMenu, CustomizeDropdownItem,
  IconButton,
} from '@/components';
import { gettext, PERMISSION_TYPES } from '@/constants';
import { useAskPage, useSessions } from '../../hooks';

import './index.css';

const Session = ({ session, permission, isSelected, isTeamTab = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isShowRenameDialog, setIsShowRenameDialog] = useState(false);
  const [isShowDeleteDialog, setIsShowDeleteDialog] = useState(false);

  const { modifySession, deleteSession, shareSession, unshareSession } = useSessions();
  const { togglePageSlugId } = useAskPage();

  const openRename = useCallback(() => {
    setIsShowRenameDialog(true);
  }, []);

  const closeRename = useCallback(() => {
    setIsShowRenameDialog(false);
  }, []);

  const openDelete = useCallback(() => {
    setIsShowDeleteDialog(true);
  }, []);

  const closeDelete = useCallback(() => {
    setIsShowDeleteDialog(false);
  }, []);

  const toggleDropdown = useCallback((event) => {
    event && event.stopPropagation();
    event && event.nativeEvent && event.nativeEvent.stopImmediatePropagation();
    setIsOpen(!isOpen);
  }, [isOpen]);

  const handleShare = useCallback(() => {
    shareSession && shareSession(session._id);
  }, [shareSession, session._id]);

  const handleUnshare = useCallback(() => {
    unshareSession && unshareSession(session._id);
  }, [unshareSession, session._id]);

  const { _id: sessionId } = session;

  if (isTeamTab) {
    return (
      <div
        className={classnames('sea-qa-ai-ask-session-item', { 'active': isSelected })}
        onClick={() => togglePageSlugId(sessionId)}
      >
        <IconButton icon="chat-team" className="no-hover-bg mr-2 w-4 h-4" />
        <div className="sea-qa-ai-ask-session-name text-truncate">
          {session.name}
        </div>
      </div>
    );
  }

  const icon = session.is_shared ? 'chat-team' : 'new-chat';

  return (
    <>
      <div
        className={classnames('sea-qa-ai-ask-session-item', { 'active': isSelected || isOpen })}
        onClick={() => togglePageSlugId(sessionId)}
      >
        <IconButton icon={icon} className="no-hover-bg mr-2 w-4 h-4" />
        <div className="sea-qa-ai-ask-session-content">
          <div className="sea-qa-ai-ask-session-name text-truncate" title={session.name}>
            {session.name}
          </div>
        </div>
        {permission === PERMISSION_TYPES.READ_WRITE && (
          <Dropdown isOpen={isOpen} toggle={toggleDropdown}>
            <CustomizeDropdownMoreToggle isOpen={isOpen} className={classnames('sea-qa-ai-ask-session-more-op-btn', { 'd-flex': isSelected || isOpen })} />
            <CustomizeDropdownMenu fixed={true}>
              <CustomizeDropdownItem onClick={openRename}>
                <CustomizeDropdownItem.Icon symbol="rename" />
                <CustomizeDropdownItem.Text>{gettext('Rename')}</CustomizeDropdownItem.Text>
              </CustomizeDropdownItem>
              {session.is_shared ? (
                <>
                  {unshareSession && (
                    <CustomizeDropdownItem onClick={handleUnshare}>
                      <CustomizeDropdownItem.Icon symbol="unshare" />
                      <CustomizeDropdownItem.Text>{gettext('Unshare within team')}</CustomizeDropdownItem.Text>
                    </CustomizeDropdownItem>
                  )}
                </>
              ) : (
                <>
                  {shareSession && (
                    <CustomizeDropdownItem onClick={handleShare}>
                      <CustomizeDropdownItem.Icon symbol="share" />
                      <CustomizeDropdownItem.Text>{gettext('Share within team')}</CustomizeDropdownItem.Text>
                    </CustomizeDropdownItem>
                  )}
                </>
              )}
              <CustomizeDropdownItem onClick={openDelete}>
                <CustomizeDropdownItem.Icon symbol="delete" />
                <CustomizeDropdownItem.Text>{gettext('Delete')}</CustomizeDropdownItem.Text>
              </CustomizeDropdownItem>
            </CustomizeDropdownMenu>
          </Dropdown>
        )}
      </div>
      {isShowRenameDialog && (
        <CustomizeNameDialog
          title={gettext('Chat name')}
          value={session.name}
          onToggle={closeRename}
          onSubmit={(name) => modifySession(sessionId, { name })}
        />
      )}
      {isShowDeleteDialog && (
        <CommonOperationConfirmationDialog
          title={gettext('Delete chat')}
          message={gettext('Are you sure you want to delete chat {placeholder} ?').replace('{placeholder}', `<b>${session.name}</b>`)}
          executeOperation={() => deleteSession(sessionId)}
          confirmBtnText={gettext('Delete')}
          toggleDialog={closeDelete}
        />
      )}
    </>
  );
};

export default Session;
