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
  onClose, onSubmitCallback, convertToTicket
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

  const handleSubmit = () => {
    setIsSubmitting(true);
    const { previewText, images, links, checklist } = getPreviewContent(content);
    const ticket_content = {
      text: content,
      preview: previewText,
      images,
      links,
      checklist,
    };
    let validType = type;
    if (type) {
      const typeRow = getRowById(typesData, type);
      if (typeRow) {
        validType = typeRow.name;
      }
    }

    const substateRow = getRowById(substatesData, substate);

    const ticketData = {
      title,
      content: ticket_content,
      type: validType,
      assignees,
      tags,
      priority,
      state: state === TICKET_STATE.OPEN ? 'open' : 'closed',
      substate: substateRow?.origin_name || substate,
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
  }, [projectUuid, row, convertToTicket, openSubstate]);

  return (
    <Modal className="seaqa-create-ticket-dialog" isOpen={true} toggle={onClose}>
      <ModalHeader toggle={onClose}>{gettext('Create related ticket')}</ModalHeader>
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
          {isSubmitting ? (<CenteredLoading />) : gettext('Submit')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default CreateTicketDialog;
