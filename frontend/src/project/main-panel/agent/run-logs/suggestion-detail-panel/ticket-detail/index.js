import React, { useState, useMemo, useEffect } from 'react';
import { FormGroup, Label, Input } from 'reactstrap';
import { gettext } from '@/constants';
import { useMetadata, useTags } from '@/project/hooks';
import { useCollaborators } from '@/sea-metadata';
import {
  CollaboratorsSettings, TypeSettings, PrioritySettings,
  StateSettings, SubStateSettings, DueDateSettings,
} from '@/project/main-panel/tickets/components/ticket-settings';
import TagsSettings from '@/project/main-panel/tags/tags-settings';
import { appendLinkedRecord } from '@/project/main-panel/connections/utils';

import './index.css';

const TicketDetail = ({ isEdit, isSaving, value, relatedUrl, onChange }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [state, setState] = useState('');
  const [substate, setSubstate] = useState('');
  const [type, setType] = useState('');
  const [tags, setTags] = useState([]);
  const [priority, setPriority] = useState(0);
  const [due_date, setDueDate] = useState('');
  const [isInit, setIsInit] = useState(true);

  const { tagsData, createTag } = useTags();
  const { substatesData } = useMetadata();

  const isReadonly = useMemo(() => !isEdit || isSaving, [isEdit, isSaving]);

  useEffect(() => {
    setIsInit(true);
    try {
      const initValue = JSON.parse(value);
      const { title, content, assignees, participants, state, substate, type, tags, priority, due_date } = initValue;
      const initState = state || '0001';
      setTitle(title || '');
      setContent(appendLinkedRecord(content, relatedUrl));
      setAssignees(Array.isArray(assignees) ? assignees : []);
      setParticipants(Array.isArray(participants) ? participants : []);
      setState(initState);
      const firstSubstate = substatesData.rows.find(r => r.parent_id === initState);
      setSubstate(substate || firstSubstate?._id || '');
      setType(type || '');
      setTags(Array.isArray(tags) ? tags : []);
      setPriority(priority || 0);
      setDueDate(due_date || '');
    } catch {
      const initState = '0001';
      setTitle('');
      setContent('');
      setAssignees([]);
      setParticipants([]);
      setState(initState);
      const firstSubstate = substatesData.rows.find(r => r.parent_id === initState);
      setSubstate(firstSubstate?._id || '');
      setType('');
      setTags([]);
      setPriority(0);
      setDueDate('');
    } finally {
      setIsInit(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, relatedUrl]);

  useEffect(() => {
    if (isInit) return;

    const data = {
      title,
      content,
      type,
      assignees,
      tags,
      priority,
      state,
      substate,
      due_date,
      participants,
    };
    const newValue = JSON.stringify(data);
    if (value === newValue) return;
    onChange(JSON.stringify(data));
  }, [isInit, value, title, content, assignees, participants, state, substate, type, tags, priority, due_date, onChange]);

  return (
    <div className="seaqa-ticket-draft-detail">
      <div className="seaqa-ticket-draft-title">
        {gettext('Draft')}
      </div>
      <div className="seaqa-ticket-draft-body">
        <FormGroup className="mb-4">
          <Label for="ticketTitle">
            {gettext('Title')}
            <span className="required-tip" title={gettext('Required')}>{'*'}</span>
          </Label>
          <Input
            type="text"
            name="title"
            id="ticketTitle"
            value={title}
            readOnly={isReadonly}
            onChange={(e) => setTitle(e.target.value)}
          />
        </FormGroup>
        <FormGroup className="mb-4">
          <Label for="ticketContent">
            {gettext('Content')}
          </Label>
          <Input
            className="seaqa-ticket-content"
            type="textarea"
            name="content"
            id="ticketContent"
            value={content}
            readOnly={isReadonly}
            onChange={(e) => setContent(e.target.value)}
          />
        </FormGroup>
        <PrioritySettings isReadonly={isReadonly} value={priority} onChange={setPriority} />
        <CollaboratorsSettings
          isReadonly={isReadonly}
          title={gettext('Assignees')}
          value={assignees}
          tip={gettext('No one assigned')}
          useCollaborators={useCollaborators}
          onChange={setAssignees}
        />
        <TagsSettings
          isReadonly={isReadonly}
          value={tags}
          tagsData={tagsData}
          createTag={createTag}
          onChange={setTags}
        />
        <TypeSettings isReadonly={isReadonly} value={type} onChange={setType} useMetadataContext={useMetadata} />
        <StateSettings
          isReadonly={isReadonly}
          state={state}
          substate={substate}
          useMetadataContext={useMetadata}
          onChange={(nextState, nextSubstate) => {
            setState(nextState);
            setSubstate(nextSubstate);
          }}
        />
        <SubStateSettings
          isReadonly={isReadonly}
          state={state}
          substate={substate}
          useMetadataContext={useMetadata}
          onChange={setSubstate}
        />
        <DueDateSettings
          isReadonly={isReadonly}
          value={due_date}
          onChange={setDueDate}
        />
        <CollaboratorsSettings
          isReadonly={isReadonly}
          title={gettext('Participants')}
          value={participants}
          tip={gettext('No participants')}
          useCollaborators={useCollaborators}
          onChange={setParticipants}
        />
      </div>
    </div>
  );
};

export default TicketDetail;
