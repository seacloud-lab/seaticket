import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import { Button, Input, Label } from 'reactstrap';
import { name, avatarURL, username, gettext, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE } from '@/constants';
import { isLongTextValueExceedLimit } from '@/utils/long-text';
import { toaster } from '@/components';
import { TICKET_PAGE_SLUG_ID } from '../../constants';
import { CollaboratorsSettings, TagsSettings, TypeSettings, RateSettings } from '../../components/ticket-settings';
import { Utils } from '../../../../../utils/utils';
import { ticketsAPI } from '../../../../api';
import { useTicketsPage } from '../../hooks';
import UploadFilesButton from '../../components/upload-files-btn';
import { getRowById, getRowsByIds } from '@/sea-metadata/utils/row';
import { useTypes, useTags } from '../../hooks';

import './index.css';

const NewTicket = ({ editorAPI, projectUuid }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [type, setType] = useState('');
  const [tags, setTags] = useState([]);
  const [priority, setPriority] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const contentEditorRef = useRef(null);

  const { typesData } = useTypes();
  const { tagsData } = useTags();

  const user = useMemo(() => {
    return {
      name,
      username,
      avatar_url: avatarURL
    };
  }, []);

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

    ticketsAPI.createProjectTicket(projectUuid, serverData).then(res => {
      togglePageSlugId(res.data.ticket._pk);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setIsSubmitting(false);
    });
  }, [title, content, type, assignees, tags, priority]);

  const disabled = (!title || !title.trim()) || (!content || !content.text.trim()) || isSubmitting;

  return (
    <div className="sea-qa-project-new-ticket">
      <div className="sea-qa-project-ticket-user">
        <img src={user.avatar_url} alt={user.name} />
      </div>
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
              <div className="ml-2">
                <Button className="mr-4" onClick={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.ALL)}>{gettext('Cancel')}</Button>
                <Button onClick={onSubmit} color="primary" disabled={disabled}>{gettext('Submit')}</Button>
              </div>
            </div>
          </div>
          <div className="sea-qa-project-ticket-other-settings">
            <RateSettings isReadonly={isSubmitting} value={priority} onChange={setPriority} />
            <CollaboratorsSettings isReadonly={isSubmitting} title={gettext('Assignees')} value={assignees} onChange={setAssignees} />
            <TagsSettings isReadonly={isSubmitting} value={tags} onChange={setTags} />
            <TypeSettings isReadonly={isSubmitting} value={type} onChange={setType} />
          </div>
        </div>
      </div>
    </div>
  );

};

export default NewTicket;
