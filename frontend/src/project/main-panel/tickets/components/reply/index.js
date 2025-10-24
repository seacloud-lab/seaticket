import React, { useCallback, useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem, Button } from 'reactstrap';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import { Icon, CustomizeMarkdownViewer, CommonOperationConfirmationDialog, toaster } from '@/components';
import { gettext, LONG_TEXT_EXCEED_LIMIT_MESSAGE } from '@/constants';
import { useCollaborators } from '@/sea-metadata';
import { downloadFile } from '@/utils/download';
import { isLongTextValueExceedLimit } from '@/utils/long-text';
import UploadFilesButton from '../upload-files-btn';

import './index.css';

const Reply = ({
  isShowStatus = false,
  readonly = true,
  reply,
  projectUuid,
  className,
  lang,
  editorAPI,
  children,
  onDelete,
  onModify,
}) => {
  const [creator, setCreator] = useState({});
  const [isOpen, setIsOpen] = useState(false);
  const [isShowEditor, setIsShowEditor] = useState(false);
  const [isShowDeleteDialog, setIsShowDeleteDialog] = useState(false);
  const { getCollaborator, queryUser } = useCollaborators();
  const [content, setContent] = useState(reply.content);

  const replyEditorRef = useRef(null);
  const isChangeRef = useRef(false);

  const onLinkClick = useCallback((link) => {
    if (link.includes(`/project/${projectUuid}/`)) {
      downloadFile(link);
      return;
    }
    window.open(link, '_blank');
  }, [projectUuid]);

  const openEditor = useCallback(() => {
    isChangeRef.current = false;
    setIsShowEditor(true);
  }, []);

  const closeEditor = useCallback(() => {
    isChangeRef.current = false;
    setIsShowEditor(false);
    setContent(reply.content);
  }, [reply]);

  const handleFiles = useCallback((files) => {
    if (files.length === 0) return;
    const editor = replyEditorRef.current.getEditor();
    const eventBus = EventBus.getInstance();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = /image/i.test(file.type);
      const fileName = file.name;
      editorAPI.uploadLocalImage(file).then(url => {
        eventBus.dispatch(EXTERNAL_EVENTS.INSERT_ATTACHMENTS, editor, { title: fileName, url, isImage });
      });
    }
  }, [editorAPI]);

  const onReplyChange = useCallback((value) => {
    if (isLongTextValueExceedLimit(value)) {
      toaster.closeAll();
      toaster.danger(LONG_TEXT_EXCEED_LIMIT_MESSAGE, { duration: null });
      return;
    }
    isChangeRef.current = true;
    setContent(value);
  }, []);

  const handleUpdateReply = useCallback(() => {
    onModify && onModify(content, (error) => {
      if (!error) {
        isChangeRef.current = false;
        setContent(content?.text);
        setIsShowEditor(false);
        return;
      }
    });
  }, [content, onModify]);

  useEffect(() => {
    const creator = getCollaborator(reply.creator);
    if (creator) {
      setCreator(creator);
      return;
    }
    queryUser(reply.creator, (userMap) => {
      const creator = userMap[reply.creator];
      setCreator(creator);
    });
  }, [reply.creator]);

  if (!reply) return null;
  const { created_at } = reply;

  if (!readonly && (onDelete || onModify)) {

    return (
      <>
        <div className={classnames('sea-qa-project-ticket-reply editing', className)}>
          <div className="sea-qa-project-ticket-reply-user-avatar">
            <img src={creator.avatar_url} alt={creator.name} />
          </div>
          <div className="sea-qa-project-ticket-reply-container">
            <div className="sea-qa-project-ticket-reply-op">
              <div className="sea-qa-project-ticket-reply-op-log">
                <span className="sea-qa-project-ticket-reply-user-name mr-1">{creator.name}</span>
                {isShowStatus && (
                  <span className="sea-qa-project-ticket-reply-status mr-1">{gettext('opened')}</span>
                )}
                <span className="sea-qa-project-ticket-reply-time">{created_at}</span>
              </div>
              {!isShowEditor && (
                <Dropdown
                  isOpen={isOpen}
                  className="sea-qa-project-ticket-reply-op-more-dropdown"
                  toggle={() => setIsOpen(!isOpen)}
                >
                  <DropdownToggle className="dropdown-toggle-button sea-qa-icon-btn" tag="div">
                    <Icon symbol="more" />
                  </DropdownToggle>
                  <DropdownMenu
                    className="sea-qa-dropdown-menu dropdown-menu my-1 mr-2 position-fixed"
                    modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]}
                  >
                    {onModify && (
                      <DropdownItem onClick={openEditor}>
                        <Icon symbol="rename" className="item-icon" />
                        {gettext('Edit')}
                      </DropdownItem>
                    )}
                    {onDelete && (
                      <DropdownItem onClick={() => setIsShowDeleteDialog(true)}>
                        <Icon symbol="delete" className="item-icon" />
                        {gettext('Delete')}
                      </DropdownItem>
                    )}
                  </DropdownMenu>
                </Dropdown>
              )}
            </div>
            <div className={classnames('sea-qa-project-ticket-reply-content', { 'p-2 editing': isShowEditor })}>
              {isShowEditor ? (
                <>
                  <LongTextInlineEditor
                    isAlwaysEnableEdit={true}
                    ref={replyEditorRef}
                    lang={lang}
                    headerName={gettext('Reply')}
                    value={content || ''}
                    autoSave={false}
                    saveDelay={20 * 1000}
                    isCheckBrowser={true}
                    isImageUploadOnly={false}
                    isSupportMultipleFiles={true}
                    editorApi={editorAPI}
                    onSaveEditorValue={onReplyChange}
                  />
                  <div className="sea-qa-project-ticket-footer mt-2 pl-0">
                    <UploadFilesButton onChange={handleFiles} />
                    <div className="ml-2">
                      <Button className="mr-4" onClick={closeEditor}>{gettext('Cancel')}</Button>
                      <Button disabled={!isChangeRef.current || (isChangeRef.current && !content?.text)} color="primary" onClick={handleUpdateReply}>{gettext('Update comment')}</Button>
                    </div>
                  </div>
                </>
              ) : (
                <CustomizeMarkdownViewer value={content} showTOC={false} onLinkClick={onLinkClick} />
              )}
            </div>
          </div>
        </div>
        {isShowDeleteDialog && (
          <CommonOperationConfirmationDialog
            title={gettext('Delete comment')}
            message={gettext('Are you sure you want to delete the comment ?')}
            executeOperation={() => onDelete(reply)}
            confirmBtnText={gettext('Delete')}
            toggleDialog={() => setIsShowDeleteDialog(false)}
          />
        )}
      </>
    );
  }

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
            <CustomizeMarkdownViewer value={content} showTOC={false} onLinkClick={onLinkClick} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Reply;
