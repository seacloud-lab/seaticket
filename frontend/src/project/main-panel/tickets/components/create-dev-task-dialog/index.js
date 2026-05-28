import { useEffect, useMemo, useState } from 'react';
import { Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Label, Input } from 'reactstrap';
import { getPreviewContent } from '@seafile/seafile-editor';
import { gettext } from '@/constants';
import { toaster, ModalHeader, CenteredLoading, CenteredError } from '@/components';
import { connectionsAPI } from '@/project/api';
import { useConnections } from '@/project/main-panel/connections/hooks';
import { CONNECTION_TYPE } from '@/project/main-panel/connections/constants';
import { getTableName } from '@/project/main-panel/connections/utils';
import { useData } from '@/project/hooks';
import { useCollaborators } from '@/sea-metadata';
import { TICKET_TABLE_NAME } from '../../constants';
import { generatorTicketURL } from '../../utils';
import { CollaboratorsSettings } from '../ticket-settings';
import { Utils } from '@/utils/utils';

import './index.css';

const STATUS_OPTIONS = [
  { value: 'new', label: gettext('New') },
  { value: 'in_progress', label: gettext('In progress') },
  { value: 'done', label: gettext('Done') },
  { value: 'canceled', label: gettext('Canceled') },
];

const SIZE_OPTIONS = [
  { value: 'small', label: gettext('Small') },
  { value: 'medium', label: gettext('Medium') },
  { value: 'large', label: gettext('Large') },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: gettext('Low') },
  { value: 'medium', label: gettext('Medium') },
  { value: 'high', label: gettext('High') },
];

const parseCollaborators = (value) => {
  if (!value) return [];
  return value.split(',').map(item => item.trim()).filter(Boolean);
};

const normalizeCollaboratorEmails = (values, collaborators = []) => {
  if (!Array.isArray(values)) return [];
  const emailByName = {};
  collaborators.forEach((user) => {
    if (user?.name && user?.email && !emailByName[user.name]) {
      emailByName[user.name] = user.email;
    }
  });

  return Array.from(new Set(values.map((value) => {
    const normalizedValue = typeof value === 'string' ? value.trim() : value?.email;
    if (!normalizedValue) return null;
    return emailByName[normalizedValue] || normalizedValue;
  }).filter(Boolean)));
};

const getDefaultPriority = (ticketPriority) => {
  const value = Number(ticketPriority);
  if (Number.isNaN(value)) return 'medium';
  if (value >= 4) return 'high';
  if (value >= 2) return 'medium';
  return 'low';
};

const getTicketContent = (ticket) => {
  const rawContent = ticket?.content;
  if (rawContent && typeof rawContent === 'object') {
    return rawContent.text || rawContent.preview || '';
  }
  return rawContent || '';
};

const buildDescriptionDict = (text) => {
  const raw = (text || '').trim();
  const { previewText, images, links, checklist } = getPreviewContent(raw);
  return {
    text: raw,
    preview: previewText,
    images,
    links,
    checklist,
  };
};

const buildDescriptionPayload = (value) => {
  if (value && typeof value === 'object') {
    return value;
  }
  return buildDescriptionDict(value);
};

const CreateTaskDialog = ({
  projectUuid,
  workspaceID,
  projectName,
  ticket,
  onClose,
  onSubmitCallback,
}) => {
  const { connections } = useConnections();
  const { markTablesViewExpired } = useData();
  const { collaborators, setScopedCollaborators, clearScopedCollaborators } = useCollaborators();

  const [isSubmitting, setSubmitting] = useState(false);
  const [errorMessage, setErrMessage] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('new');
  const [size, setSize] = useState('medium');
  const [priority, setPriority] = useState('medium');
  const [assignees, setAssignees] = useState([]);
  const [participants, setParticipants] = useState('');
  const [version, setVersion] = useState('');
  const [dueDate, setDueDate] = useState('');

  const generalTaskConnections = useMemo(() => {
    return (connections || []).filter(connection => connection.type === CONNECTION_TYPE.GENERAL_TASK);
  }, [connections]);

  const collaboratorScopeKey = useMemo(() => {
    if (!connectionId) return '';
    return `create-general-task-${connectionId}`;
  }, [connectionId]);

  useEffect(() => {
    if (generalTaskConnections.length === 0) return;
    setConnectionId(prevValue => prevValue || String(generalTaskConnections[0].id));
  }, [generalTaskConnections]);

  useEffect(() => {
    if (!projectUuid || !connectionId) return;

    let isCancelled = false;
    connectionsAPI.getConnectionRelatedUsers(projectUuid, connectionId).then((res) => {
      if (isCancelled) return;
      const relatedUsers = Array.isArray(res?.data?.related_users) ? res.data.related_users : [];
      setScopedCollaborators(collaboratorScopeKey, relatedUsers);
    }).catch(() => {
      if (isCancelled) return;
      clearScopedCollaborators(collaboratorScopeKey);
    });

    return () => {
      isCancelled = true;
      clearScopedCollaborators(collaboratorScopeKey);
    };
  }, [projectUuid, connectionId, collaboratorScopeKey, setScopedCollaborators, clearScopedCollaborators]);

  useEffect(() => {
    const ticketTitle = ticket?.title || '';
    const ticketContent = getTicketContent(ticket);
    const relatedUrl = generatorTicketURL({ ticket, workspaceID, projectName });
    const suffix = `${gettext('Related ticket')}: ${relatedUrl}`;
    const initContent = ticketContent ? `${ticketContent}\n\n${suffix}` : suffix;

    setTitle(ticketTitle);
    setContent(initContent);
    setPriority(getDefaultPriority(ticket?.priority));
    setAssignees(Array.isArray(ticket?.assignees) ? ticket.assignees.filter(Boolean) : []);
    setParticipants(Array.isArray(ticket?.participants) ? ticket.participants.join(', ') : '');
    setDueDate(ticket?.due_date || '');
  }, [ticket, workspaceID, projectName]);

  const handleSubmit = () => {
    if (isSubmitting) return;
    if (!connectionId) {
      setErrMessage(gettext('Please select a task connection.'));
      return;
    }

    setSubmitting(true);
    setErrMessage('');
    const selectedConnection = generalTaskConnections.find(connection => String(connection.id) === String(connectionId));
    const payload = {
      title: title.trim(),
      description: buildDescriptionPayload(content),
      status,
      size,
      priority,
      assignees: normalizeCollaboratorEmails(assignees, collaborators),
      participants: parseCollaborators(participants),
      version: version.trim(),
      due_date: dueDate || '',
      linked_ticket: ticket?._id || ticket?.id,
    };

    connectionsAPI.createConnectionRecord(projectUuid, connectionId, payload).then((res) => {
      const row = res?.data?.row || {};
      const linkedKey = `${connectionId}_${row._pk}`;
      const linkedRecord = {
        [linkedKey]: {
          ...row,
          title: row.title || payload.title,
          state: row.status || payload.status,
          connection_type: selectedConnection?.type || CONNECTION_TYPE.GENERAL_TASK,
        }
      };

      if (selectedConnection) {
        markTablesViewExpired([getTableName(selectedConnection), TICKET_TABLE_NAME]);
      } else {
        markTablesViewExpired([TICKET_TABLE_NAME]);
      }
      toaster.success(gettext('Task created'));
      onSubmitCallback && onSubmitCallback({ linkedKey, linkedRecord, row, connection: selectedConnection });
      onClose();
    }).catch((error) => {
      const msg = Utils.getErrorMsg(error);
      setErrMessage(msg);
    }).finally(() => {
      setSubmitting(false);
    });
  };

  return (
    <Modal className="seaqa-create-task-dialog" isOpen={true} toggle={onClose}>
      <ModalHeader toggle={onClose}>{gettext('Create task')}</ModalHeader>
      <ModalBody>
        {generalTaskConnections.length === 0 && (
          <CenteredError>{gettext('No task connection available.')}</CenteredError>
        )}
        {generalTaskConnections.length > 0 && (
          <>
            {errorMessage && <CenteredError>{errorMessage}</CenteredError>}
            <div className="d-flex">
              <div className="seaqa-create-task-dialog-left-settings">
                <Form>
                  <FormGroup>
                    <Label for="devTaskTitle">
                      {gettext('Title')}
                      <span className="required-tip" title={gettext('Required')}>{'*'}</span>
                    </Label>
                    <Input
                      type="text"
                      id="devTaskTitle"
                      value={title}
                      readOnly={isSubmitting}
                      onChange={(event) => setTitle(event.target.value)}
                      className="mb-4"
                    />
                  </FormGroup>
                  <FormGroup>
                    <Label for="devTaskContent">{gettext('Content')}</Label>
                    <Input
                      className="seaqa-task-content"
                      type="textarea"
                      id="devTaskContent"
                      value={content}
                      readOnly={isSubmitting}
                      onChange={(event) => setContent(event.target.value)}
                    />
                  </FormGroup>
                </Form>
              </div>
              <div className="seaqa-create-task-dialog-other-settings">
                <FormGroup>
                  <Label for="devTaskConnection">
                    {gettext('Task connection')}
                    <span className="required-tip" title={gettext('Required')}>{'*'}</span>
                  </Label>
                  <Input
                    type="select"
                    id="devTaskConnection"
                    value={connectionId}
                    disabled={isSubmitting}
                    onChange={(event) => setConnectionId(event.target.value)}
                  >
                    {generalTaskConnections.map(connection => (
                      <option key={connection.id} value={connection.id}>{connection.name}</option>
                    ))}
                  </Input>
                </FormGroup>
                <FormGroup>
                  <Label for="devTaskPriority">{gettext('Priority')}</Label>
                  <Input
                    type="select"
                    id="devTaskPriority"
                    value={priority}
                    disabled={isSubmitting}
                    onChange={(event) => setPriority(event.target.value)}
                  >
                    {PRIORITY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Input>
                </FormGroup>
                <FormGroup>
                  <Label for="devTaskStatus">{gettext('Status')}</Label>
                  <Input
                    type="select"
                    id="devTaskStatus"
                    value={status}
                    disabled={isSubmitting}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    {STATUS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Input>
                </FormGroup>
                <FormGroup>
                  <Label for="devTaskSize">{gettext('Size')}</Label>
                  <Input
                    type="select"
                    id="devTaskSize"
                    value={size}
                    disabled={isSubmitting}
                    onChange={(event) => setSize(event.target.value)}
                  >
                    {SIZE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Input>
                </FormGroup>
                <FormGroup>
                  <CollaboratorsSettings
                    id="dev-task-assignees-editor-popover"
                    isReadonly={isSubmitting}
                    title={gettext('Assignees')}
                    value={assignees}
                    className="mb-3"
                    onChange={setAssignees}
                  />
                </FormGroup>
                <FormGroup>
                  <Label for="devTaskParticipants">{gettext('Participants')}</Label>
                  <Input
                    type="text"
                    id="devTaskParticipants"
                    value={participants}
                    readOnly={isSubmitting}
                    onChange={(event) => setParticipants(event.target.value)}
                    placeholder={gettext('Separate multiple values with commas')}
                  />
                </FormGroup>
                <FormGroup>
                  <Label for="devTaskVersion">{gettext('Version')}</Label>
                  <Input
                    type="text"
                    id="devTaskVersion"
                    value={version}
                    readOnly={isSubmitting}
                    onChange={(event) => setVersion(event.target.value)}
                  />
                </FormGroup>
                <FormGroup className="mb-0">
                  <Label for="devTaskDueDate">{gettext('Due date')}</Label>
                  <Input
                    type="text"
                    id="devTaskDueDate"
                    value={dueDate}
                    readOnly={isSubmitting}
                    onChange={(event) => setDueDate(event.target.value)}
                    placeholder="YYYY-MM-DD HH:mm:ss"
                  />
                </FormGroup>
              </div>
            </div>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onClose}>{gettext('Cancel')}</Button>
        <Button
          color="primary"
          onClick={handleSubmit}
          disabled={generalTaskConnections.length === 0 || !title.trim() || isSubmitting}
        >
          {isSubmitting ? (<CenteredLoading />) : gettext('Submit')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default CreateTaskDialog;
