import { useCallback, useState } from 'react';
import classnames from 'classnames';
import { Dropdown, DropdownMenu, DropdownItem } from 'reactstrap';
import { CustomizeDropdownMoreToggle, Icon, CustomizeNameDialog, CommonOperationConfirmationDialog } from '@/components';
import { gettext, PERMISSION_TYPES } from '@/constants';
import { useAskPage, useSessions } from '../../hooks';

import './index.css';

const Session = ({ session, permission, isSelected }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isShowRenameDialog, setIsShowRenameDialog] = useState(false);
  const [isShowDeleteDialog, setIsShowDeleteDialog] = useState(false);

  const { modifySession, deleteSession } = useSessions();
  const { togglePageType } = useAskPage();

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

  const { _id: sessionId } = session;

  return (
    <>
      <div
        className={classnames('sea-qa-ai-ask-session-item', { 'active': isSelected || isOpen })}
        onClick={() => togglePageType(sessionId)}
      >
        <div className="sea-qa-ai-ask-session-name text-truncate">
          {session.name}
        </div>
        {permission === PERMISSION_TYPES.READ_WRITE && (
          <Dropdown isOpen={isOpen} toggle={toggleDropdown}>
            <CustomizeDropdownMoreToggle isOpen={isOpen} className={classnames('sea-qa-ai-ask-session-more-op-btn', { 'd-flex': isOpen })} />
            <DropdownMenu
              className="position-fixed sea-qa-dropdown-menu dropdown-menu"
              modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]}
            >
              <DropdownItem onClick={openRename}>
                <Icon symbol="rename" className="item-icon" />
                <span>{gettext('Rename')}</span>
              </DropdownItem>
              <DropdownItem onClick={openDelete}>
                <Icon symbol="delete" className="item-icon" />
                <span>{gettext('Delete')}</span>
              </DropdownItem>
            </DropdownMenu>
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
