import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { FormGroup, Label, Input } from 'reactstrap';
import { gettext } from '@/constants';
import { useMetadata, useTags } from '@/project/hooks';
import TagsSettings from '@/project/main-panel/tags/tags-settings';
import {
  CollaboratorsSettings, TypeSettings, PrioritySettings,
  StateSettings, SubStateSettings, DueDateSettings,
} from '@/project/main-panel/tickets/components/ticket-settings';
import { TICKET, PREDEFINED_TICKET_COLUMN_NAME } from '@/project/main-panel/tickets/constants';
import { useCollaborators } from '@/sea-metadata';

import './index.css';

const TicketDetail = ({ isEdit, isSaving, value, onChange }) => {
  const [ticket, setTicket] = useState(TICKET);

  const { tagsData, createTag } = useTags();
  const { substatesData } = useMetadata();

  const isReadonly = useMemo(() => !isEdit || isSaving, [isEdit, isSaving]);

  const handleChange = useCallback((update) => {
    const newTicket = { ...ticket, ...update };
    setTicket(newTicket);
    onChange && onChange(JSON.stringify(newTicket));
  }, [ticket, onChange]);

  useEffect(() => {
    try {
      const { title, content, assignees, participants, state, substate, type, tags, priority, due_date } = JSON.parse(value);
      const initState = state || '0001';
      const firstSubstate = substatesData.rows.find(r => r.parent_id === initState);
      setTicket({
        [PREDEFINED_TICKET_COLUMN_NAME.TITLE]: title || '',
        [PREDEFINED_TICKET_COLUMN_NAME.CONTENT]: content || '',
        [PREDEFINED_TICKET_COLUMN_NAME.ASSIGNEES]: Array.isArray(assignees) ? assignees : [],
        [PREDEFINED_TICKET_COLUMN_NAME.PARTICIPANTS]: Array.isArray(participants) ? participants : [],
        [PREDEFINED_TICKET_COLUMN_NAME.STATE]: initState,
        [PREDEFINED_TICKET_COLUMN_NAME.SUB_STATE]: substate || firstSubstate?._id || '',
        [PREDEFINED_TICKET_COLUMN_NAME.TYPE]: type || '',
        [PREDEFINED_TICKET_COLUMN_NAME.TAGS]: Array.isArray(tags) ? tags : [],
        [PREDEFINED_TICKET_COLUMN_NAME.PRIORITY]: priority || 0,
        [PREDEFINED_TICKET_COLUMN_NAME.DUE_DATE]: due_date || '',
      });
    } catch {
      const initState = '0001';
      const firstSubstate = substatesData.rows.find(r => r.parent_id === initState);
      setTicket({
        ...TICKET,
        [PREDEFINED_TICKET_COLUMN_NAME.STATE]: initState,
        [PREDEFINED_TICKET_COLUMN_NAME.SUB_STATE]: firstSubstate?._id || '',
      });
    }
  }, [value, substatesData]);

  const { title, content, assignees, participants, state, substate, type, tags, priority, due_date } = ticket;

  return (
    <div className="seaqa-suggestion-detail-draft">
      <div className="seaqa-suggestion-detail-draft-title">
        {gettext('Draft')}
      </div>
      <div className="seaqa-suggestion-detail-draft-body">
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
            onChange={(e) => handleChange({ [PREDEFINED_TICKET_COLUMN_NAME.TITLE]: e.target.value })}
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
            onChange={(e) => handleChange({ [PREDEFINED_TICKET_COLUMN_NAME.CONTENT]: e.target.value })}
          />
        </FormGroup>
        <PrioritySettings
          isReadonly={isReadonly}
          value={priority}
          onChange={(v) => handleChange({ [PREDEFINED_TICKET_COLUMN_NAME.PRIORITY]: v })}
        />
        <CollaboratorsSettings
          isReadonly={isReadonly}
          title={gettext('Assignees')}
          value={assignees}
          tip={gettext('No one assigned')}
          useCollaborators={useCollaborators}
          onChange={(v) => handleChange({ [PREDEFINED_TICKET_COLUMN_NAME.ASSIGNEES]: v })}
        />
        <TagsSettings
          isReadonly={isReadonly}
          value={tags}
          tagsData={tagsData}
          createTag={createTag}
          onChange={(v) => handleChange({ [PREDEFINED_TICKET_COLUMN_NAME.TAGS]: v })}
        />
        <TypeSettings
          isReadonly={isReadonly}
          value={type}
          onChange={(v) => handleChange({ [PREDEFINED_TICKET_COLUMN_NAME.TYPE]: v })}
          useMetadataContext={useMetadata}
        />
        <StateSettings
          isReadonly={isReadonly}
          state={state}
          substate={substate}
          useMetadataContext={useMetadata}
          onChange={(nextState, nextSubstate) => {
            handleChange({
              [PREDEFINED_TICKET_COLUMN_NAME.STATE]: nextState,
              [PREDEFINED_TICKET_COLUMN_NAME.SUB_STATE]: nextSubstate
            });
          }}
        />
        <SubStateSettings
          isReadonly={isReadonly}
          state={state}
          substate={substate}
          useMetadataContext={useMetadata}
          onChange={(v) => handleChange({ [PREDEFINED_TICKET_COLUMN_NAME.SUB_STATE]: v })}
        />
        <DueDateSettings
          isReadonly={isReadonly}
          value={due_date}
          onChange={(v) => handleChange({ [PREDEFINED_TICKET_COLUMN_NAME.DUE_DATE]: v })}
        />
        <CollaboratorsSettings
          isReadonly={isReadonly}
          title={gettext('Participants')}
          value={participants}
          tip={gettext('No participants')}
          useCollaborators={useCollaborators}
          onChange={(v) => handleChange({ [PREDEFINED_TICKET_COLUMN_NAME.PARTICIPANTS]: v })}
        />
      </div>
    </div>
  );
};

export default TicketDetail;
