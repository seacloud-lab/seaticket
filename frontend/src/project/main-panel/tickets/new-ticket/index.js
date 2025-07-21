import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LongTextInlineEditor } from '@seafile/seafile-editor';
import { Button, Input, Label } from 'reactstrap';
import { name, avatarURL, username, gettext, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE } from '../../../../constants';
import { isLongTextValueExceedLimit } from '../../../../utils/long-text';
import { toaster, Collaborator, CollaboratorEditor, Option, OptionEditor, } from '../../../../components';
import { useTickets } from '../../../hooks';
import { seaQAAPI } from '../../../../api/web-api';
import { Utils } from '../../../../utils/utils';
import { TICKET_TYPES } from '../../../constants';

import './index.css';

const {
  projectUuid,
} = window.app.pageOptions;

const NewTicket = ({ togglePage }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [assignees, setAssignees] = useState([]);
  const [isShowAssigneesEditor, setIsShowAssigneesEditor] = useState(false);

  const [type, setType] = useState('');
  const [isShowTypeEditor, setIsShowTypeEditor] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const descriptionEditorRef = useRef(null);
  const assigneesRef = useRef(null);
  const typeEditorRef = useRef(null);

  const user = useMemo(() => {
    return {
      name,
      username,
      avatar_url: avatarURL
    };
  }, []);

  const { collaborators } = useTickets();

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

  // assignees
  const deleteAssignee = useCallback((email) => {
    const newValue = assignees.filter(i => i !== email);
    setAssignees(newValue);
  }, [assignees]);

  const onAssigneesChange = useCallback((assignees) => {
    setAssignees(assignees);
    setIsShowAssigneesEditor(false);
  }, []);

  const openAssigneesEditor = useCallback(() => {
    setIsShowAssigneesEditor(true);
  }, []);

  const closeAssigneesEditor = useCallback(() => {
    setIsShowAssigneesEditor(false);
  }, []);

  // type
  const openTypeEditor = useCallback(() => {
    setIsShowTypeEditor(true);
  }, []);

  const closeTypeEditor = useCallback(() => {
    setIsShowTypeEditor(false);
  }, []);

  const onTypeChange = useCallback((type) => {
    setType(type);
  }, []);

  const onSubmit = useCallback(() => {
    const validTitle = title.trim();
    const validDescription = description ? description.text : '';
    seaQAAPI.createProjectTicket(projectUuid, { title: validTitle, description: validDescription, type, participants: assignees, tags: [] }).then(res => {
      togglePage(res.data.ticket.number);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setIsSubmitting(false);
    });
  }, [title, description, type, assignees, togglePage]);

  const typeOption = TICKET_TYPES.find(o => o.id === type);

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
                <Button className="mr-4" onClick={() => togglePage('all')}>{gettext('Cancel')}</Button>
                <Button onClick={onSubmit} color="primary" disabled={!title || !title.trim() || isSubmitting}>{gettext('Submit')}</Button>
              </div>
            </div>
            <div className="sea-qa-project-ticket-other-settings">
              <div className="sea-qa-project-ticket-settings-item mb-4">
                <Label>{gettext('Assignees')}</Label>
                <div className="collaborators-formatter" onClick={openAssigneesEditor} ref={assigneesRef}>
                  {assignees.length > 0 ? assignees.map(assignee => {
                    if (!assignee) return null;
                    const collaborator = collaborators.find(c => c.email === assignee);
                    return (
                      <Collaborator collaborator={collaborator} key={assignee}>
                        {!isSubmitting && (<Collaborator.RemoveBtn callback={() => deleteAssignee(assignee)} />)}
                      </Collaborator>
                    );
                  }) : (<div className="tip-default">{gettext('No one assigned')}</div>)}
                </div>
              </div>
              <div className="sea-qa-project-ticket-settings-item mb-4">
                <Label>{gettext('Labels')}</Label>
                <div className="labels-formatter">
                  <div className="tip-default">{gettext('Not support(todo)')}</div>
                </div>
              </div>
              <div className="sea-qa-project-ticket-settings-item mb-4">
                <Label>{gettext('Type')}</Label>
                <div className="ticket-types-formatter" onClick={openTypeEditor} ref={typeEditorRef}>
                  {typeOption ? (<Option option={typeOption} />) : (<div className="tip-default">{gettext('No type')}</div>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {!isSubmitting && isShowAssigneesEditor && (
        <CollaboratorEditor
          target={assigneesRef}
          value={assignees}
          placeholder={gettext('Select assignees')}
          emptyTip={gettext('No assignees')}
          collaborators={collaborators}
          onChange={onAssigneesChange}
          onClose={closeAssigneesEditor}
        />
      )}
      {!isSubmitting && isShowTypeEditor && (
        <OptionEditor
          target={typeEditorRef}
          value={type}
          placeholder={gettext('Select type')}
          emptyTip={gettext('No types')}
          options={TICKET_TYPES}
          onChange={onTypeChange}
          onClose={closeTypeEditor}
        />
      )}
    </>

  );

};

export default NewTicket;
