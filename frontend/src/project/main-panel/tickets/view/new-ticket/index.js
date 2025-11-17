import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import { Button, Input, Label } from 'reactstrap';
import { name, avatarURL, username, gettext, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE } from '@/constants';
import { isLongTextValueExceedLimit } from '@/utils/long-text';
import { toaster } from '@/components';
import { TICKET_PAGE_TYPE } from '../../constants';
import { CollaboratorsSettings, TagsSettings, TypeSettings, RateSettings } from '../../components/ticket-settings';
import { Utils } from '../../../../../utils/utils';
import { ticketsAPI } from '../../../../api';
import { useTicketsPage } from '../../hooks';
import UploadFilesButton from '../../components/upload-files-btn';

import './index.css';

const NewTicket = ({ editorAPI, projectUuid }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [type, setType] = useState('');
  const [tags, setTags] = useState([]);
  const [priority, setPriority] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const descriptionEditorRef = useRef(null);

  const user = useMemo(() => {
    return {
      name,
      username,
      avatar_url: avatarURL
    };
  }, []);

  const { togglePageType } = useTicketsPage();

  const onTitleChange = useCallback((event) => {
    const newTitle = event.target.value;
    if (newTitle === title) return;
    setTitle(newTitle);
  }, [title]);

  const onDescriptionChange = useCallback((value) => {
    if (isLongTextValueExceedLimit(value)) {
      toaster.closeAll();
      toaster.danger(LONG_TEXT_EXCEED_LIMIT_MESSAGE, { duration: null });
      return;
    }
    setDescription(value);
  }, []);

  const handleFiles = useCallback((files) => {
    if (files.length === 0) return;
    const editor = descriptionEditorRef.current.getEditor();
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
    ticketsAPI.createProjectTicket(projectUuid, { title: validTitle, description, type, assignees, tags, priority }).then(res => {
      togglePageType(res.data.ticket._pk);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setIsSubmitting(false);
    });
  }, [title, description, type, assignees, tags, priority]);

  const disabled = (!title || !title.trim()) || (!description || !description.text.trim()) || isSubmitting;

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
                {gettext('Description')}
                <span className="required-tip" title={gettext('Required')}>{'*'}</span>
              </Label>
              <LongTextInlineEditor
                isAlwaysEnableEdit={true}
                ref={descriptionEditorRef}
                lang={lang}
                headerName={gettext('Description')}
                value={description || ''}
                autoSave={true}
                saveDelay={20 * 1000}
                isCheckBrowser={true}
                isImageUploadOnly={false}
                isSupportMultipleFiles={true}
                editorApi={editorAPI}
                autoFocus={false}
                onSaveEditorValue={onDescriptionChange}
              />
            </div>
            <div className="sea-qa-project-ticket-footer">
              <UploadFilesButton onChange={handleFiles} />
              <div className="ml-2">
                <Button className="mr-4" onClick={() => togglePageType(TICKET_PAGE_TYPE.ALL)}>{gettext('Cancel')}</Button>
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
