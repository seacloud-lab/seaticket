import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import { Button, Input, Label, Dropdown } from 'reactstrap';
import classnames from 'classnames';
import {
  toaster,
  CustomizeDropdownMoreToggle, CustomizeDropdownMenu, CustomizeDropdownItem
} from '@/components';
import { name, avatarURL, username, gettext, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE } from '@/constants';
import { isLongTextValueExceedLimit } from '@/utils/long-text';
import { PREDEFINED_TICKET_COLUMN_NAME, TICKET_PAGE_SLUG_ID, TICKET_TABLE_NAME, TICKET_STATE_OPTIONS } from '../../constants';
import {
  CollaboratorsSettings, TypeSettings, PrioritySettings,
  StateSettings, SubStateSettings, DueDateSettings,
} from '../../components/ticket-settings';
import KeyboardShortcuts from '../../components/tickets-keyboard-shortcuts-dialog';
import { Utils } from '../../../../../utils/utils';
import { ticketsAPI } from '../../../../api';
import { useTicketsPage, useMetadata } from '../../hooks';
import UploadFilesButton from '../../components/upload-files-btn';
import { getRowById } from '@/sea-metadata/utils/row';
import { useData, useTags } from '@/project/hooks';
import TagsSettings from '@/project/main-panel/tags/tags-settings';
import { useCollaborators } from '@/sea-metadata';

import './index.css';

const NewTicket = ({ editorAPI, projectUuid }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [state, setState] = useState(TICKET_STATE_OPTIONS[0]?.id || '');
  const [substate, setSubstate] = useState('0010' || '');
  const [type, setType] = useState('');
  const [tags, setTags] = useState([]);
  const [priority, setPriority] = useState(0);
  const [due_date, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isShowKeyboardShortcuts, setIsShowKeyboardShortcuts] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const contentEditorRef = useRef(null);
  const ticketRef = useRef(null);

  const { typesData } = useMetadata();
  const { insertRow } = useData();
  const { tagsData, createTag } = useTags();

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

  const { pageSlugId, togglePageSlugId } = useTicketsPage();
  const shouldShowCancelBtn = pageSlugId === TICKET_PAGE_SLUG_ID.NEW;

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
    if (!validTitle) {
      toaster.danger(gettext('Title is required'));
      return;
    }

    const data = { title: validTitle, content, type, assignees, tags, priority, due_date, state, substate, participants };
    let serverData = {};
    Object.keys(data).forEach(columnName => {
      let value = data[columnName];
      if (columnName === PREDEFINED_TICKET_COLUMN_NAME.TYPE && value) {
        const typeOption = getRowById(typesData, value);
        value = typeOption.name;
      } else if (columnName === PREDEFINED_TICKET_COLUMN_NAME.STATE && value) {
        value = value === '0001' ? 'open' : 'closed';
      }
      serverData[columnName] = value;
    });

    ticketsAPI.createProjectTicket(projectUuid, serverData).then(res => {
      togglePageSlugId(res.data.ticket._pk);
      insertRow(TICKET_TABLE_NAME);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setIsSubmitting(false);
    });
  }, [title, content, type, assignees, tags, priority, due_date, state, substate, participants, typesData, insertRow]);

  useEffect(() => {
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
  }, []);

  const renderSubmitBtns = useCallback((className = 'ml-2') => {
    return (
      <div className={className}>
        {shouldShowCancelBtn && (
          <Button className="mr-4" onClick={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.ALL)}>{gettext('Cancel')}</Button>
        )}
        <Button onClick={onSubmit} color="primary" disabled={disabled}>{gettext('Submit')}</Button>
      </div>
    );
  }, [disabled, togglePageSlugId, onSubmit, shouldShowCancelBtn]);

  // 892: comment min-width(584) + others min-width(260) + gap: 16 * 3
  const isSmallScreen = containerWidth < 892;

  return (
    <div className={classnames('seaqa-project-new-ticket', { 'small': isSmallScreen })} ref={ticketRef}>
      {!isSmallScreen && (
        <div className="seaqa-project-ticket-user">
          <img src={user.avatar_url} alt={user.name} />
        </div>
      )}
      <div className="seaqa-project-ticket-settings">
        <div className="seaqa-project-ticket-name-container mb-3">
          <div className="seaqa-project-ticket-name text-truncate">
            {gettext('New ticket')}
          </div>
          <Dropdown isOpen={isMoreMenuOpen} toggle={() => setIsMoreMenuOpen(!isMoreMenuOpen)}>
            <CustomizeDropdownMoreToggle isOpen={isMoreMenuOpen} title={gettext('More')} />
            <CustomizeDropdownMenu className="position-fixed">
              <CustomizeDropdownItem onClick={() => { setIsShowKeyboardShortcuts(true); setIsMoreMenuOpen(false); }}>
                {gettext('Open keyboard shortcuts')}
              </CustomizeDropdownItem>
            </CustomizeDropdownMenu>
          </Dropdown>
        </div>
        <div className="seaqa-project-ticket-settings-container">
          <div className="seaqa-project-ticket-content-settings">
            <div className="seaqa-project-ticket-title mb-4">
              <Label>
                {gettext('Title')}
                <span className="required-tip" title={gettext('Required')}>{'*'}</span>
              </Label>
              <Input autoFocus disabled={isSubmitting} value={title} onChange={onTitleChange} />
            </div>
            <div className="seaqa-project-ticket-content mb-4">
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
            <div className="seaqa-project-ticket-footer">
              <UploadFilesButton onChange={handleFiles} />
              {!isSmallScreen && renderSubmitBtns()}
            </div>
          </div>
          <div className="seaqa-project-ticket-other-settings">
            <PrioritySettings isReadonly={isSubmitting} value={priority} onChange={setPriority} />
            <CollaboratorsSettings
              id="assignees-editor-popover"
              isReadonly={isSubmitting}
              title={gettext('Assignees')}
              value={assignees}
              tip={gettext('No one assigned')}
              useCollaborators={useCollaborators}
              onChange={setAssignees}
            />
            <TagsSettings
              id="tags-editor-popover"
              isReadonly={isSubmitting}
              value={tags}
              tagsData={tagsData}
              createTag={createTag}
              onChange={setTags}
            />
            <StateSettings
              isReadonly={isSubmitting}
              state={state}
              substate={substate}
              useMetadataContext={useMetadata}
              onChange={(nextState, nextSubstate) => {
                setState(nextState);
                setSubstate(nextSubstate);
              }}
            />
            <SubStateSettings
              isReadonly={isSubmitting}
              state={state}
              substate={substate}
              useMetadataContext={useMetadata}
              onChange={setSubstate}
            />
            <TypeSettings id="type-editor-popover" isReadonly={isSubmitting} value={type} useMetadataContext={useMetadata} onChange={setType} />
            <DueDateSettings isReadonly={isSubmitting} value={due_date} onChange={setDueDate} />
            <CollaboratorsSettings
              id="participants-editor-popover"
              isReadonly={isSubmitting}
              title={gettext('Participants')}
              value={participants}
              tip={gettext('No participants')}
              useCollaborators={useCollaborators}
              onChange={setParticipants}
            />
          </div>
          {isSmallScreen && renderSubmitBtns('seaqa-project-ticket-submit-btns')}
        </div>
      </div>
      {isShowKeyboardShortcuts && (
        <KeyboardShortcuts toggle={() => setIsShowKeyboardShortcuts(false)} />
      )}
    </div>
  );

};

export default NewTicket;
