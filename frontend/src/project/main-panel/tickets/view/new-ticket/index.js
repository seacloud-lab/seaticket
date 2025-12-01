import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import { Button, Input, Label } from 'reactstrap';
import classnames from 'classnames';
import { name, avatarURL, username, gettext, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE } from '@/constants';
import { isLongTextValueExceedLimit } from '@/utils/long-text';
import { CenteredLoading, toaster } from '@/components';
import { PREDEFINED_TICKET_COLUMN_NAME, TICKET_PAGE_SLUG_ID, TICKET_STATE } from '../../constants';
import { CollaboratorsSettings, TagsSettings, TypeSettings, RateSettings } from '../../components/ticket-settings';
import { Utils } from '../../../../../utils/utils';
import { ticketsAPI } from '../../../../api';
import { useTicketsPage } from '../../hooks';
import UploadFilesButton from '../../components/upload-files-btn';
import { getRowById, getRowsByIds } from '@/sea-metadata/utils/row';
import { useMetadata } from '../../hooks';

import './index.css';

const NewTicket = ({ editorAPI, projectUuid }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [type, setType] = useState('');
  const [tags, setTags] = useState([]);
  const [priority, setPriority] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const contentEditorRef = useRef(null);
  const ticketRef = useRef(null);

  const { tagsData, typesData, substatesData, isLoading: isMetadataLoading } = useMetadata();

  const user = useMemo(() => {
    return {
      name,
      username,
      avatar_url: avatarURL
    };
  }, []);
  const disabled = useMemo(() => {
    return (!title || !title.trim()) || (!content || !content.text.trim()) || isSubmitting;
  }, [title, content, isSubmitting]);

  const { togglePageSlugId } = useTicketsPage();

  const onTitleChange = useCallback((event) => {
    const newTitle = event.target.value;
    if (newTitle === title) return;
    setTitle(newTitle);
  }, [title]);

  const onContentChange = useCallback((value) => {
    if (isLongTextValueExceedLimit(value)) {
      toaster.closeAll();
      toaster.danger(LONG_TEXT_EXCEED_LIMIT_MESSAGE, { duration: null });
      return;
    }
    setContent(value);
  }, []);

  const handleFiles = useCallback((files) => {
    if (files.length === 0) return;
    const editor = contentEditorRef.current.getEditor();
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

  const onSubmit = useCallback(() => {
    const validTitle = title.trim();
    const data = { title: validTitle, content, type, assignees, tags, priority };
    let serverData = {};
    Object.keys(data).forEach(columnName => {
      let value = data[columnName];
      if (columnName === 'tags' && Array.isArray(value) && value.length > 0) {
        const tags = getRowsByIds(tagsData, value);
        value = tags.map(tag => tag.name);
      } else if (columnName === 'type' && value) {
        const typeOption = getRowById(typesData, value);
        value = typeOption.name;
      } else if (columnName === 'state' && value) {
        value = value === '0001' ? 'open' : 'closed';
      }
      serverData[columnName] = value;
    });

    const substateOptions = substatesData.rows.filter(r => r.parent_id === TICKET_STATE.OPEN);
    const substateOption = substateOptions[0];
    serverData[PREDEFINED_TICKET_COLUMN_NAME.SUB_STATE] = substateOption?.name;

    ticketsAPI.createProjectTicket(projectUuid, serverData).then(res => {
      togglePageSlugId(res.data.ticket._pk);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setIsSubmitting(false);
    });
  }, [title, content, type, assignees, tags, priority]);

  useEffect(() => {
    if (isMetadataLoading) return;
    const ticketDom = ticketRef.current;
    const handleResize = () => {
      if (!ticketDom) return;
      setContainerWidth(ticketDom.offsetWidth);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    ticketDom && resizeObserver.observe(ticketDom);

    return () => {
      ticketDom && resizeObserver.unobserve(ticketDom);
    };
  }, [isMetadataLoading]);

  const renderSubmitBtns = useCallback((className = 'ml-2') => {
    return (
      <div className={className}>
        <Button className="mr-4" onClick={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.ALL)}>{gettext('Cancel')}</Button>
        <Button onClick={onSubmit} color="primary" disabled={disabled}>{gettext('Submit')}</Button>
      </div>
    );
  }, [disabled, togglePageSlugId, onSubmit]);

  if (isMetadataLoading) return (<CenteredLoading />);

  const isSmallScreen = containerWidth < 848;

  return (
    // 848: comment min-width(540) + others min-width(260) + gap: 16 * 3
    <div className={classnames('sea-qa-project-new-ticket', { 'small': isSmallScreen })} ref={ticketRef}>
      {!isSmallScreen && (
        <div className="sea-qa-project-ticket-user">
          <img src={user.avatar_url} alt={user.name} />
        </div>
      )}
      <div className="sea-qa-project-ticket-settings">
        <div className="sea-qa-project-ticket-name mb-3">{gettext('New ticket')}</div>
        <div className="sea-qa-project-ticket-settings-container">
          <div className="sea-qa-project-ticket-content-settings">
            <div className="sea-qa-project-ticket-title mb-4">
              <Label>
                {gettext('Title')}
                <span className="required-tip" title={gettext('Required')}>{'*'}</span>
              </Label>
              <Input autoFocus disabled={isSubmitting} value={title} onChange={onTitleChange} />
            </div>
            <div className="sea-qa-project-ticket-content mb-4">
              <Label>
                {gettext('Content')}
                <span className="required-tip" title={gettext('Required')}>{'*'}</span>
              </Label>
              <LongTextInlineEditor
                isAlwaysEnableEdit={true}
                ref={contentEditorRef}
                lang={lang}
                headerName={gettext('Content')}
                value={content || ''}
                autoSave={true}
                saveDelay={20 * 1000}
                isCheckBrowser={true}
                isImageUploadOnly={false}
                isSupportMultipleFiles={true}
                editorApi={editorAPI}
                autoFocus={false}
                onSaveEditorValue={onContentChange}
              />
            </div>
            <div className="sea-qa-project-ticket-footer">
              <UploadFilesButton onChange={handleFiles} />
              {!isSmallScreen && renderSubmitBtns()}
            </div>
          </div>
          <div className="sea-qa-project-ticket-other-settings">
            <RateSettings isReadonly={isSubmitting} value={priority} onChange={setPriority} />
            <CollaboratorsSettings isReadonly={isSubmitting} title={gettext('Assignees')} value={assignees} onChange={setAssignees} />
            <TagsSettings isReadonly={isSubmitting} value={tags} onChange={setTags} />
            <TypeSettings isReadonly={isSubmitting} value={type} onChange={setType} />
          </div>
          {isSmallScreen && renderSubmitBtns('sea-qa-project-ticket-submit-btns')}
        </div>
      </div>
    </div>
  );

};

export default NewTicket;
