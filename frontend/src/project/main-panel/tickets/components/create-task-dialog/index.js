import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Modal, ModalBody, ModalFooter, Button, FormGroup, Label, Input } from 'reactstrap';
import axios from 'axios';
import { getPreviewContent } from '@seafile/seafile-editor';
import { gettext } from '@/constants';
import { toaster, ModalHeader, CenteredLoading, CustomizeSelect, CustomizeLabel } from '@/components';
import { connectionsAPI } from '@/project/api';
import { useConnections } from '@/project/main-panel/connections/hooks';
import { CONNECTION_TYPE, CONNECTION_PREDEFINED_COLUMN_NAME } from '@/project/main-panel/connections/constants';
import { formatColumns } from '@/project/main-panel/connections/utils';
import { generatorTicketURL } from '../../utils';
import { Utils } from '@/utils/utils';
import User from '@/models/user';
import {
  CollaboratorsSettings, DueDateSettings,
} from '../ticket-settings';
import SingleSelectSettings from '@/project/main-panel/connections/components/connection-resource-details/others/single-select-settings';
import TextSettings from '@/project/main-panel/connections/components/connection-resource-details/others/text-settings';
import { getColumnByName, getColumnOptionNameById, getColumnOptions } from '@/sea-metadata/utils/column';
import { isNumber } from '@/utils/type-detection';

import './index.css';

const convertPriority = (priority, columns) => {
  const column = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.PRIORITY);
  const options = getColumnOptions(column);
  if (!isNumber(priority)) return null;
  if (priority >= 4) return options.find(o => o.name === 'high')?.id || null;
  if (priority >= 2) return options.find(o => o.name === 'medium')?.id || null;
  return options.find(o => o.name === 'low')?.id || null;
};

const convertStatus = (status, columns) => {
  const column = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.STATUS);
  const options = getColumnOptions(column);
  return options.find(o => o.name === 'new')?.id || null;
};

const ConvertContent = ({ ticket, workspaceID, projectName }) => {
  const ticketContent = ticket?.content || '';
  const relatedUrl = generatorTicketURL({ ticket, workspaceID, projectName });
  const suffix = `${gettext('Related ticket')}: ${relatedUrl}`;
  return ticketContent ? `${ticketContent}\n\n${suffix}` : suffix;
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

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setSubmitting] = useState(false);

  const [connectionId, setConnectionId] = useState('');
  const [title, setTitle] = useState(ticket?.title || '');
  const [content, setContent] = useState(ConvertContent({ ticket, workspaceID, projectName }));
  const [status, setStatus] = useState(ticket?.status);
  const [size, setSize] = useState(ticket?.size);
  const [priority, setPriority] = useState(ticket?.priority);
  const [assignees, setAssignees] = useState(ticket?.assignees || []);
  const [version, setVersion] = useState(ticket.version || '');
  const [dueDate, setDueDate] = useState(ticket?.due_date || '');
  const [columns, setColumns] = useState([]);

  const abortControllerRef = useRef(null);
  const lastConnectionId = useRef(null);

  const generalTaskConnections = useMemo(() => {
    return (connections || []).filter(connection => connection.type === CONNECTION_TYPE.GENERAL_TASK);
  }, [connections]);
  const statusColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.STATUS), [columns]);
  const sizeColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.SIZE), [columns]);
  const priorityColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.PRIORITY), [columns]);
  const assigneesColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.ASSIGNEES), [columns]);
  const versionColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.VERSION), [columns]);
  const generalTaskConnectionsOptions = useMemo(() => {
    return generalTaskConnections.map(c => ({
      value: c.id,
      label: c.name,
    }));
  }, [generalTaskConnections]);

  const onSelectConnection = useCallback((newValue) => {
    if (connectionId === newValue) return;
    setConnectionId(newValue);
  }, [connectionId]);

  const handleSubmit = () => {
    if (isSubmitting) return;

    setSubmitting(true);
    const connection = generalTaskConnections.find(connection => connection.id === connectionId);
    const task = {
      title: title.trim(),
      description: buildDescriptionPayload(content),
      status: getColumnOptionNameById(statusColumn, status),
      size: getColumnOptionNameById(sizeColumn, size),
      priority: getColumnOptionNameById(priorityColumn, priority),
      assignees,
      version: version.trim(),
      due_date: dueDate || '',
      linked_ticket: ticket?._id || ticket?.id,
    };

    connectionsAPI.createConnectionRecord(projectUuid, connectionId, task).then((res) => {
      const row = res?.data?.row || {};
      const activities = res?.data?.activities || [];
      toaster.success(gettext('Task created'));
      onSubmitCallback && onSubmitCallback({ task: row, connection, activities });
      onClose();
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    }).finally(() => {
      setSubmitting(false);
    });
  };

  useEffect(() => {
    if (generalTaskConnections.length === 0) return;
    setConnectionId(prevValue => prevValue || generalTaskConnections[0].id);
  }, [generalTaskConnections]);

  useEffect(() => {
    if (!projectUuid || !connectionId || lastConnectionId.current === connectionId) return;
    lastConnectionId.current = connectionId;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    connectionsAPI.getConnectionMetadata(projectUuid, connectionId, abortControllerRef.current.signal).then((res) => {
      const columns = Array.isArray(res?.data?.columns) ? res.data.columns : [];
      const relatedUsers = Array.isArray(res?.data?.related_users) ? res.data.related_users : [];
      const collaborators = relatedUsers.map(user => new User(user));
      const targetColumns = formatColumns({ type: CONNECTION_TYPE.GENERAL_TASK }, columns, { collaborators });

      setPriority(convertPriority(ticket.priority, targetColumns));
      setStatus(convertStatus(ticket.status, targetColumns));

      let nextAssignees = Array.isArray(ticket?.assignees) ? ticket.assignees : [];
      nextAssignees = nextAssignees.filter(assignee => assignee && collaborators.find(c => c.email === assignee));
      setAssignees(nextAssignees);

      setColumns(targetColumns);
      setIsLoading(false);
    }).catch((error) => {
      if (!axios.isCancel(error)) {
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(this.props.gettext(errorMessage));
      }
      setIsLoading(false);
    }).finally(() => {
      abortControllerRef.current = null;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectUuid, connectionId]);

  return (
    <Modal className="seaqa-create-task-dialog" isOpen={true} toggle={onClose}>
      <ModalHeader toggle={onClose}>{gettext('Create task')}</ModalHeader>
      <ModalBody className="seaqa-create-task-dialog-body">
        <div className="seaqa-create-task-main-settings">
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
        </div>
        <div className="seaqa-create-task-other-settings">
          <div className="seaqa-settings-item mb-4">
            <CustomizeLabel icon="connection">
              {gettext('Connection')}
            </CustomizeLabel>
            <CustomizeSelect
              className="mb-2"
              value={generalTaskConnectionsOptions.find(o => o.value === connectionId)}
              options={generalTaskConnectionsOptions}
              onChange={onSelectConnection}
              placeholder={gettext('Select a connection')}
              searchable={true}
              searchPlaceholder={gettext('Search connections')}
              noOptionsPlaceholder={gettext('No connections available')}
              isInModal={true}
            />
          </div>
          <SingleSelectSettings id="status-editor-popover" isReadonly={isSubmitting || isLoading} value={status} column={statusColumn} onChange={setStatus} />
          <SingleSelectSettings id="priority-editor-popover" isReadonly={isSubmitting || isLoading} value={priority} column={priorityColumn} onChange={setPriority} />
          <SingleSelectSettings id="size-editor-popover" isReadonly={isSubmitting || isLoading} value={size} column={sizeColumn} onChange={setSize} />
          <CollaboratorsSettings
            id="assignees-editor-popover"
            isReadonly={isSubmitting || isLoading}
            title={gettext('Assignees')}
            tip={gettext('No one assigned')}
            value={assignees}
            useCollaborators={() => ({ collaborators: [], ...assigneesColumn?.data })}
            onChange={setAssignees}
          />
          <TextSettings isReadonly={isSubmitting || isLoading} column={versionColumn} value={version || ''} onChange={setVersion} />
          <DueDateSettings isReadonly={isSubmitting || isLoading} value={dueDate} onChange={setDueDate} />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onClose}>{gettext('Cancel')}</Button>
        <Button
          color="primary"
          style={{ height: 38 }}
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
