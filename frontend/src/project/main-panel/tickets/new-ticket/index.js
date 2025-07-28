import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LongTextInlineEditor } from '@seafile/seafile-editor';
import { Button, Input, Label } from 'reactstrap';
import { name, avatarURL, username, gettext, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE } from '../../../../constants';
import { isLongTextValueExceedLimit } from '../../../../utils/long-text';
import { toaster } from '../../../../components';
import { useTickets } from '../../../hooks';
import { TICKET_PAGE_TYPE } from '../../../constants';
import { AssigneesSettings, LabelSettings, TypeSettings } from '../ticket-settings';
import { Utils } from '../../../../utils/utils';

import './index.css';

const NewTicket = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [assignees, setAssignees] = useState([]);

  const [type, setType] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const descriptionEditorRef = useRef(null);

  const user = useMemo(() => {
    return {
      name,
      username,
      avatar_url: avatarURL
    };
  }, []);

  const { collaborators, createTicket, togglePageType } = useTickets();

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

  const onSubmit = useCallback(() => {
    const validTitle = title.trim();
    const validDescription = description ? description.text : '';
    createTicket({ title: validTitle, description: validDescription, type, assignees, tags: [] }).then(res => {
      // nothing
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setIsSubmitting(false);
    });
  }, [title, description, type, assignees, createTicket]);

  return (
    <>
      <div className="sea-qa-project-new-ticket">
        <div className="sea-qa-project-ticket-user">
          <img src={user.avatar_url} alt={user.name} />
        </div>
        <div className="sea-qa-project-ticket-settings">
          <div className="sea-qa-project-ticket-name mb-3">{gettext('Create new ticket')}</div>
          <div className="sea-qa-project-ticket-settings-container">
            <div className="sea-qa-project-ticket-content-settings">
              <div className="sea-qa-project-ticket-title mb-4">
                <Label>
                  {gettext('Add a title')}
                  <span className="required-tip" title={gettext('Required')}>{'*'}</span>
                </Label>
                <Input disabled={isSubmitting} value={title} placeholder={gettext('Title')} onChange={onTitleChange} />
              </div>
              <div className="sea-qa-project-ticket-content mb-0">
                <Label>{gettext('Add a description')}</Label>
                <LongTextInlineEditor
                  isAlwaysEnableEdit={true}
                  ref={descriptionEditorRef}
                  lang={lang}
                  headerName={gettext('Description')}
                  value={description || ''}
                  autoSave={true}
                  saveDelay={20 * 1000}
                  isCheckBrowser={true}
                  onSaveEditorValue={onDescriptionChange}
                />
              </div>
              <div className="sea-qa-project-ticket-footer">
                <Button className="mr-4" onClick={() => togglePageType(TICKET_PAGE_TYPE.ALL)}>{gettext('Cancel')}</Button>
                <Button onClick={onSubmit} color="primary" disabled={!title || !title.trim() || isSubmitting}>{gettext('Submit')}</Button>
              </div>
            </div>
            <div className="sea-qa-project-ticket-other-settings">
              <AssigneesSettings isReadonly={isSubmitting} assignees={assignees} collaborators={collaborators} onChange={setAssignees} />
              <LabelSettings />
              <TypeSettings isReadonly={isSubmitting} type={type} onChange={setType} />
            </div>
          </div>
        </div>
      </div>
    </>

  );

};

export default NewTicket;
