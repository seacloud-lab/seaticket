import { useState, useEffect, useMemo } from 'react';
import { Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Label, Input } from 'reactstrap';
import { getPreviewContent } from '@seafile/seafile-editor';
import { ticketsAPI } from '@/project/api';
import { gettext } from '@/constants';
import { toaster, ModalHeader, CenteredLoading, CenteredError } from '@/components';
import {
  CollaboratorsSettings, TypeSettings, PrioritySettings,
  StateSettings, SubStateSettings, DueDateSettings,
} from '../../../tickets/components/ticket-settings';
import { getRowById } from '@/sea-metadata/utils/row';
import { TICKET_STATE, TICKET_STATE_OPTIONS } from '@/project/main-panel/tickets/constants';
import { useTags } from '@/project/hooks';
import { Utils } from '@/utils/utils';
import TagsSettings from '@/project/main-panel/tags/tags-settings';
import { useCollaborators } from '@/sea-metadata';

import './index.css';

const CreateTicketDialog = ({
  projectUuid, row, linkedRecordPrefix,
  useMetadataContext,
  onClose, onSubmitCallback, convertToTicket,
  initialTicketData,
  dialogTitle,
  submitButtonText,
  onSubmit,
}) => {
  const [isLoading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrMessage] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [state, setState] = useState(TICKET_STATE_OPTIONS[0]?.id || '0001');
  const [substate, setSubstate] = useState('0010' || '');
  const [type, setType] = useState('');
  const [tags, setTags] = useState([]);
  const [priority, setPriority] = useState(0);
  const [due_date, setDueDate] = useState('');
  const isDraftMode = typeof onSubmit === 'function';

  const { typesData, substatesData } = useMetadataContext();
  const { tagsData, createTag } = useTags();

  const openSubstate = useMemo(() => {
    if (!substatesData?.rows) return '';
    const firstSubstate = substatesData.rows.find(r => r.parent_id === TICKET_STATE.OPEN);
    return firstSubstate ? firstSubstate._id : '';
  }, [substatesData]);

  useEffect(() => {
    if (!substate && openSubstate) {
      setSubstate(openSubstate);
    }
  }, [substate, openSubstate]);

  const resolveTypeValue = useMemo(() => {
    return (ticketData = {}) => {
      const ticketType = ticketData?.type || '';
      if (ticketType && getRowById(typesData, ticketType)) return ticketType;
      const ticketTypeName = ticketData?.type_name || ticketType;
      if (!ticketTypeName || !Array.isArray(typesData?.rows)) return '';
      const matchedType = typesData.rows.find(row => row?.name === ticketTypeName);
      return matchedType?._id || '';
    };
  }, [typesData]);

  const resolveSubstateValue = useMemo(() => {
    return (ticketData = {}, nextState) => {
      const ticketSubstate = ticketData?.substate || '';
      if (ticketSubstate && getRowById(substatesData, ticketSubstate)) return ticketSubstate;
      const ticketSubstateName = ticketData?.substate_name || ticketSubstate;
      if (ticketSubstateName && Array.isArray(substatesData?.rows)) {
        const matchedSubstate = substatesData.rows.find((row) => {
          if (!row) return false;
          if (row.parent_id && nextState && row.parent_id !== nextState) return false;
          return row.origin_name === ticketSubstateName || row.name === ticketSubstateName;
        });
        if (matchedSubstate?._id) return matchedSubstate._id;
      }
      return nextState === TICKET_STATE.OPEN ? openSubstate : '';
    };
  }, [substatesData, openSubstate]);

  const applyInitialTicketData = useMemo(() => {
    return (ticketData = {}) => {
      const nextState = ticketData?.state === TICKET_STATE.CLOSED || ticketData?.state_name === 'closed'
        ? TICKET_STATE.CLOSED
        : TICKET_STATE.OPEN;
      setTitle(ticketData?.title || '');
      setContent(ticketData?.content || '');
      setAssignees(Array.isArray(ticketData?.assignees) ? ticketData.assignees : []);
      setParticipants(Array.isArray(ticketData?.participants) ? ticketData.participants : []);
      setType(resolveTypeValue(ticketData));
      setTags(Array.isArray(ticketData?.tags) ? ticketData.tags : []);
      setPriority(ticketData?.priority || 0);
      setState(nextState);
      setSubstate(resolveSubstateValue(ticketData, nextState));
      setDueDate(ticketData?.due_date || '');
    };
  }, [resolveSubstateValue, resolveTypeValue]);

  const handleSubmit = () => {
    const substateRow = substate ? getRowById(substatesData, substate) : null;
    if (substate && !substateRow) {
      setErrMessage(gettext('Substate invalid.'));
      return;
    }

    setIsSubmitting(true);
    setErrMessage('');
    const typeRow = getRowById(typesData, type);
    const stateName = state === TICKET_STATE.CLOSED ? 'closed' : 'open';
    if (isDraftMode) {
      Promise.resolve().then(() => onSubmit({
        title,
        content,
        assignees,
        participants,
        type,
        type_name: typeRow?.name || '',
        tags,
        priority,
        state,
        state_name: stateName,
        substate,
        substate_name: substateRow?.origin_name || substateRow?.name || '',
        due_date,
      })).catch((error) => {
        setErrMessage(Utils.getErrorMsg(error));
      }).finally(() => {
        setIsSubmitting(false);
      });
      return;
    }

    const { previewText, images, links, checklist } = getPreviewContent(content);
    const ticket_content = {
      text: content,
      preview: previewText,
      images,
      links,
      checklist,
    };

    let validType = typeRow?.name || type;

    const ticketData = {
      title,
      content: ticket_content,
      type: validType,
      assignees,
      tags,
      priority,
      state: state === TICKET_STATE.OPEN ? 'open' : 'closed',
      substate: substateRow ? substateRow.origin_name : '',
      due_date,
      participants,
      linked_connection_records: [`${linkedRecordPrefix}_${row._id}`],
    };
    ticketsAPI.createProjectTicket(projectUuid, ticketData).then((res) => {
      toaster.success(gettext('Ticket created'));
      onClose();
      onSubmitCallback && onSubmitCallback(res.data.ticket);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setErrMessage(errorMessage);
    }).finally(() => {
      setIsSubmitting(false);
    });
  };

  useEffect(() => {
    if (isDraftMode) {
      setErrMessage('');
      applyInitialTicketData(initialTicketData || {});
      setLoading(false);
      return;
    }
    setLoading(true);
    convertToTicket(projectUuid, row._id).then(res => {
      let { title, content, assignees, type, tags, priority, related_url } = { title: '', content: '', assignees: [], type: '', tags: [], priority: 0, related_url: '', ...res?.data };
      const suffix = `${gettext('Linked record')}: ${related_url || ''}`;
      const initContent = content ? `${content}\n\n${suffix}` : suffix;
      setTitle(title || '');
      setContent(initContent || '');
      setAssignees(assignees || []);
      setType(type || '');
      setTags(tags || []);
      setPriority(priority || 0);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setErrMessage(errorMessage);
    }).finally(() => {
      setLoading(false);
    });
  }, [applyInitialTicketData, convertToTicket, initialTicketData, isDraftMode, projectUuid, row, openSubstate]);

  return (
    <Modal className="seaqa-create-ticket-dialog" isOpen={true} toggle={onClose}>
      <ModalHeader toggle={onClose}>{dialogTitle || gettext('Create related ticket')}</ModalHeader>
      <ModalBody>
        {isLoading && <CenteredLoading/>}
        {!isLoading && errorMessage && (<CenteredError>{errorMessage}</CenteredError>)}
        {!isLoading && !errorMessage && (
          <div className="d-flex">
            <div className="seaqa-create-ticket-dialog-left-settings">
              <Form>
                <FormGroup>
                  <Label for="ticketTitle">
                    {gettext('Title')}
                    <span className="required-tip" title={gettext('Required')}>{'*'}</span>
                  </Label>
                  <Input
                    type="text"
                    name="title"
                    id="ticketTitle"
                    value={title}
                    readOnly={isLoading}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mb-4"
                  />
                </FormGroup>
                <FormGroup>
                  <Label for="ticketContent">{gettext('Content')}</Label>
                  <Input
                    className="seaqa-ticket-content"
                    type="textarea"
                    name="content"
                    id="ticketContent"
                    value={content}
                    readOnly={isLoading}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </FormGroup>
              </Form>
            </div>
            <div className="seaqa-create-ticket-dialog-other-settings">
              <PrioritySettings isReadonly={isLoading} value={priority} onChange={setPriority} />
              <CollaboratorsSettings
                isReadonly={isLoading}
                title={gettext('Assignees')}
                value={assignees}
                tip={gettext('No one assigned')}
                useCollaborators={useCollaborators}
                onChange={setAssignees}
              />
              <TagsSettings
                isReadonly={isLoading}
                value={tags}
                tagsData={tagsData}
                createTag={createTag}
                onChange={setTags}
              />
              <TypeSettings isReadonly={isLoading} value={type} onChange={setType} useMetadataContext={useMetadataContext} />
              <StateSettings
                isReadonly={isLoading}
                state={state}
                substate={substate}
                useMetadataContext={useMetadataContext}
                onChange={(nextState, nextSubstate) => {
                  setState(nextState);
                  setSubstate(nextSubstate);
                }}
              />
              <SubStateSettings
                isReadonly={isLoading}
                state={state}
                substate={substate}
                useMetadataContext={useMetadataContext}
                onChange={setSubstate}
              />
              <DueDateSettings
                isReadonly={isLoading}
                value={due_date}
                onChange={setDueDate}
              />
              <CollaboratorsSettings
                isReadonly={isLoading}
                title={gettext('Participants')}
                value={participants}
                tip={gettext('No participants')}
                useCollaborators={useCollaborators}
                onChange={setParticipants}
              />
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onClose}>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={handleSubmit} disabled={isLoading || !title.trim() || isSubmitting}>
          {isSubmitting ? (<CenteredLoading />) : (submitButtonText || gettext('Submit'))}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default CreateTicketDialog;
