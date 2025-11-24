import React, { useCallback, useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import { Dropdown, DropdownToggle, Button } from 'reactstrap';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import { Icon, CustomizeMarkdownViewer, CommonOperationConfirmationDialog, toaster, CustomizeDropdownMenu, CustomizeDropdownItem, CenteredLoading } from '@/components';
import { gettext, LONG_TEXT_EXCEED_LIMIT_MESSAGE } from '@/constants';
import { useCollaborators } from '@/sea-metadata';
import { downloadFile } from '@/utils/download';
import { isLongTextValueExceedLimit } from '@/utils/long-text';
import UploadFilesButton from '../upload-files-btn';

import './index.css';

const Comment = ({
  isSmallScreen = false,
  isShowStatus = false,
  readonly = true,
  comment,
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
  const [isShowCommentLoading, setIsShowCommentLoading] = useState(false);
  const { getCollaborator, queryUser } = useCollaborators();
  const [content, setContent] = useState(comment.content);

  const commentRef = useRef(null);
  const commentEditorRef = useRef(null);
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
    setContent(comment.content);
  }, [comment]);

  const handleFiles = useCallback((files) => {
    if (files.length === 0) return;
    const editor = commentEditorRef.current.getEditor();
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

  const onCommentChange = useCallback((value) => {
    if (isLongTextValueExceedLimit(value)) {
      toaster.closeAll();
      toaster.danger(LONG_TEXT_EXCEED_LIMIT_MESSAGE, { duration: null });
      return;
    }
    isChangeRef.current = true;
    setContent(value);
  }, []);

  const handleUpdateComment = useCallback(() => {
    setIsShowCommentLoading(true);
    onModify && onModify(content, (error) => {
      if (!error) {
        isChangeRef.current = false;
        setContent(content?.text);
        setIsShowEditor(false);
        setIsShowCommentLoading(false);
        return;
      }
      setIsShowCommentLoading(false);
    });
  }, [content, onModify]);

  useEffect(() => {
    const creator = getCollaborator(comment.creator);
    if (creator) {
      setCreator(creator);
      return;
    }
    queryUser(comment.creator, (userMap) => {
      const creator = userMap[comment.creator];
      setCreator(creator);
    });
  }, [comment.creator]);

  const renderAvatar = useCallback(() => {
    return (
      <div className="sea-qa-project-ticket-comment-user-avatar">
        <img src={creator.avatar_url} alt={creator.name} />
      </div>
    );
  }, [creator, isSmallScreen]);

  const renderOperationLog = useCallback(() => {
    const { created_time } = comment;
    return (
      <>
        {isSmallScreen && renderAvatar()}
        <span className="sea-qa-project-ticket-comment-user-name mr-1">{creator.name}</span>
        {isShowStatus && (
          <span className="sea-qa-project-ticket-comment-status mr-1">{gettext('opened')}</span>
        )}
        <span className="sea-qa-project-ticket-comment-time">{created_time}</span>
      </>
    );
  }, [isShowStatus, isSmallScreen, creator, comment, renderAvatar]);

  if (!comment) return null;

  if (!readonly && (onDelete || onModify)) {
    return (
      <>
        <div className={classnames('sea-qa-project-ticket-comment editing', className, { 'small': isSmallScreen })} ref={commentRef}>
          {!isSmallScreen && renderAvatar()}
          <div className="sea-qa-project-ticket-comment-container">
            <div className="sea-qa-project-ticket-comment-op">
              <div className="sea-qa-project-ticket-reply-op-log">
                {renderOperationLog()}
              </div>
              {!isShowEditor && (
                <Dropdown
                  isOpen={isOpen}
                  className="sea-qa-project-ticket-comment-op-more-dropdown"
                  toggle={() => setIsOpen(!isOpen)}
                >
                  <DropdownToggle className="dropdown-toggle-button sea-qa-icon-btn" tag="div">
                    <Icon symbol="more" />
                  </DropdownToggle>
                  <CustomizeDropdownMenu fixed={true} className="my-1 mr-2">
                    {onModify && (
                      <CustomizeDropdownItem onClick={openEditor}>
                        <CustomizeDropdownItem.Icon symbol="rename" />
                        {gettext('Edit')}
                      </CustomizeDropdownItem>
                    )}
                    {onDelete && (
                      <CustomizeDropdownItem onClick={() => setIsShowDeleteDialog(true)}>
                        <CustomizeDropdownItem.Icon symbol="delete" />
                        {gettext('Delete')}
                      </CustomizeDropdownItem>
                    )}
                  </CustomizeDropdownMenu>
                </Dropdown>
              )}
            </div>
            <div className={classnames('sea-qa-project-ticket-comment-content', { 'p-2 editing': isShowEditor })}>
              {isShowEditor ? (
                <>
                  <LongTextInlineEditor
                    isAlwaysEnableEdit={true}
                    ref={commentEditorRef}
                    lang={lang}
                    headerName={gettext('Comment')}
                    value={content || ''}
                    autoSave={false}
                    saveDelay={20 * 1000}
                    isCheckBrowser={true}
                    isImageUploadOnly={false}
                    isSupportMultipleFiles={true}
                    editorApi={editorAPI}
                    onSaveEditorValue={onCommentChange}
                  />
                  <div className="sea-qa-project-ticket-footer mt-2 pl-0">
                    <UploadFilesButton onChange={handleFiles} />
                    <div className="ml-2">
                      <Button className="mr-4" onClick={closeEditor}>{gettext('Cancel')}</Button>
                      <Button
                        className="sea-qa-project-ticket-footer-confirm-btn"
                        disabled={!isChangeRef.current || (isChangeRef.current && !content?.text) || isShowCommentLoading}
                        color="primary"
                        onClick={handleUpdateComment}
                      >
                        {isShowCommentLoading ? <CenteredLoading /> : gettext('Update comment')}
                      </Button>
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
            executeOperation={() => onDelete(comment)}
            confirmBtnText={gettext('Delete')}
            toggleDialog={() => setIsShowDeleteDialog(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className={classnames('sea-qa-project-ticket-comment', className, { 'small': isSmallScreen })} ref={commentRef}>
      {!isSmallScreen && renderAvatar()}
      <div className="sea-qa-project-ticket-comment-container">
        <div className="sea-qa-project-ticket-comment-op">
          <div className="sea-qa-project-ticket-reply-op-log">
            {children && children[0] ? (
              <>
                {isSmallScreen && renderAvatar()}
                {children[0]}
              </>
            ) : (
              <>
                {renderOperationLog()}
              </>
            )}
          </div>
        </div>
        <div className="sea-qa-project-ticket-comment-content">
          {children && children[1] ? children[1] : (
            <CustomizeMarkdownViewer value={content} showTOC={false} onLinkClick={onLinkClick} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Comment;
