import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Modal, ModalBody, ModalFooter, Button, FormGroup, Label, Input } from 'reactstrap';
import { getPreviewContent } from '@seafile/seafile-editor';
import axios from 'axios';
import { toaster, ModalHeader, CenteredLoading, CustomizeSelect, CustomizeLabel } from '@/components';
import { gettext } from '@/constants';
import User from '@/models/user';
import { connectionsAPI } from '@/project/api';
import LabelsSettings from '@/project/main-panel/connections/components/connection-resource-details/others/github-issues-details/labels-settings';
import SingleSelectSettings from '@/project/main-panel/connections/components/connection-resource-details/others/single-select-settings';
import TextSettings from '@/project/main-panel/connections/components/connection-resource-details/others/text-settings';
import { CONNECTION_TYPE, CONNECTION_PREDEFINED_COLUMN_NAME } from '@/project/main-panel/connections/constants';
import { useConnections } from '@/project/main-panel/connections/hooks';
import { formatColumns } from '@/project/main-panel/connections/utils';
import { getColumnByName, getColumnOptionNameById, getColumnOptions } from '@/sea-metadata/utils/column';
import { isNumber } from '@/utils/type-detection';
import { Utils } from '@/utils/utils';
import { generatorTicketURL } from '../../utils';
import {
  CollaboratorsSettings, DueDateSettings,
} from '../ticket-settings';

import './index.css';

const convertGeneralPriority = (priority, columns) => {
  const column = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.PRIORITY);
  const options = getColumnOptions(column);
  if (!isNumber(priority)) return null;
  if (priority >= 4) return options.find(o => o.name === 'high')?.id || null;
  if (priority >= 2) return options.find(o => o.name === 'medium')?.id || null;
  return options.find(o => o.name === 'low')?.id || null;
};

const convertGeneralStatus = (columns) => {
  const column = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.STATUS);
  return getColumnOptions(column).find(o => o.name === 'new')?.id || null;
};

const convertLinearPriority = (priority) => {
  if (!isNumber(priority) || priority === 0) return '0';
  return String(5 - priority);
};

const findJiraPriority = (priority, column) => {
  const options = getColumnOptions(column);
  const candidates = {
    4: ['highest', 'urgent', 'high'],
    3: ['high'],
    2: ['medium'],
    1: ['low'],
  }[priority] || [];
  return options.find(option => candidates.includes((option.name || '').toLowerCase()))?.id || '';
};

const convertContent = ({ ticket, workspaceID, projectName }) => {
  const ticketContent = ticket?.content || '';
  const relatedUrl = generatorTicketURL({ ticket, workspaceID, projectName });
  const suffix = `${gettext('Related ticket')}: ${relatedUrl}`;
  return ticketContent ? `${ticketContent}\n\n${suffix}` : suffix;
};

const buildDescriptionDict = (text) => {
  const raw = (text || '').trim();
  const { previewText, images, links, checklist } = getPreviewContent(raw);
  return { text: raw, preview: previewText, images, links, checklist };
};

const buildDescriptionPayload = (value) => {
  if (value && typeof value === 'object') return value;
  return buildDescriptionDict(value);
};

const CreateTaskDialog = ({
  projectUuid,
  workspaceID,
  projectName,
  ticket,
  connectionType = CONNECTION_TYPE.GENERAL_TASK,
  onClose,
  onSubmitCallback,
}) => {
  const { connections } = useConnections();
  const isGeneral = connectionType === CONNECTION_TYPE.GENERAL_TASK;
  const isJira = connectionType === CONNECTION_TYPE.JIRA_ISSUE;
  const isLinear = connectionType === CONNECTION_TYPE.LINEAR;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [connectionId, setConnectionId] = useState('');
  const [title, setTitle] = useState(ticket?.title || '');
  const [content, setContent] = useState(convertContent({ ticket, workspaceID, projectName }));
  const [status, setStatus] = useState(ticket?.status);
  const [size, setSize] = useState(ticket?.size);
  const [priority, setPriority] = useState(ticket?.priority);
  const [assignees, setAssignees] = useState(ticket?.assignees || []);
  const [version, setVersion] = useState(ticket?.version || '');
  const [dueDate, setDueDate] = useState(ticket?.due_date || '');
  const [columns, setColumns] = useState([]);
  const [relatedUsers, setRelatedUsers] = useState([]);
  const [issueType, setIssueType] = useState('');
  const [externalPriority, setExternalPriority] = useState('');
  const [linearState, setLinearState] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [labelIds, setLabelIds] = useState([]);

  const abortControllerRef = useRef(null);
  const lastConnectionId = useRef(null);

  const targetConnections = useMemo(() => (
    (connections || []).filter(connection => connection.type === connectionType)
  ), [connections, connectionType]);
  const connectionOptions = useMemo(() => targetConnections.map(c => ({ value: c.id, label: c.name })), [targetConnections]);
  const statusColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.STATUS), [columns]);
  const sizeColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.SIZE), [columns]);
  const priorityColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.PRIORITY), [columns]);
  const assigneesColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.ASSIGNEES), [columns]);
  const versionColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.VERSION), [columns]);
  const issueTypeColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.ISSUE_TYPE), [columns]);
  const stateColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.STATE), [columns]);
  const labelsColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.LABELS), [columns]);

  const linearPriorityColumn = useMemo(() => ({
    name: CONNECTION_PREDEFINED_COLUMN_NAME.PRIORITY,
    display_name: gettext('Priority'),
    data: {
      options: [
        { id: 'linear-priority-0', name: '0', display_name: gettext('No priority') },
        { id: 'linear-priority-1', name: '1', display_name: gettext('Urgent') },
        { id: 'linear-priority-2', name: '2', display_name: gettext('High') },
        { id: 'linear-priority-3', name: '3', display_name: gettext('Medium') },
        { id: 'linear-priority-4', name: '4', display_name: gettext('Low') },
      ],
    },
  }), []);

  const getRemoteOptionId = useCallback((column, value, remoteKey) => {
    const option = getColumnOptions(column).find(item => item.id === value || item.name === value);
    return option?.[remoteKey] || '';
  }, []);

  const handleExternalAssigneeChange = useCallback((values) => {
    const nextValues = Array.isArray(values) ? values.filter(Boolean) : [];
    setAssigneeId(nextValues[nextValues.length - 1] || '');
  }, []);

  const handleSubmit = () => {
    if (isSubmitting) return;
    setSubmitting(true);
    const connection = targetConnections.find(item => item.id === connectionId);
    let task;
    if (isGeneral) {
      task = {
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
    } else if (isJira) {
      task = {
        title: title.trim(),
        description: content,
        issue_type_id: getRemoteOptionId(issueTypeColumn, issueType, 'jira_id'),
        priority_id: getRemoteOptionId(priorityColumn, externalPriority, 'jira_id') || undefined,
        assignee_id: assigneeId || undefined,
        due_date: dueDate || '',
        linked_ticket: ticket?._id || ticket?.id,
      };
    } else {
      task = {
        title: title.trim(),
        description: content,
        state_id: getRemoteOptionId(stateColumn, linearState, 'state_id') || undefined,
        priority: externalPriority === null || externalPriority === '' ? undefined : Number(externalPriority),
        assignee_id: assigneeId || undefined,
        label_ids: labelIds.map(id => getRemoteOptionId(labelsColumn, id, 'label_id')).filter(Boolean),
        due_date: dueDate || '',
        linked_ticket: ticket?._id || ticket?.id,
      };
    }

    connectionsAPI.createConnectionRecord(projectUuid, connectionId, task).then((res) => {
      const row = res?.data?.row || {};
      const activities = res?.data?.activities || [];
      toaster.success(gettext('Task created'));
      onSubmitCallback && onSubmitCallback({ task: row, connection, activities });
      onClose();
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
    }).finally(() => setSubmitting(false));
  };

  useEffect(() => {
    if (targetConnections.length === 0) {
      setIsLoading(false);
      return;
    }
    setConnectionId(prevValue => prevValue || targetConnections[0].id);
  }, [targetConnections]);

  useEffect(() => {
    if (!projectUuid || !connectionId || lastConnectionId.current === connectionId) return;
    lastConnectionId.current = connectionId;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    connectionsAPI.getConnectionMetadata(projectUuid, connectionId, abortControllerRef.current.signal).then((res) => {
      const sourceColumns = Array.isArray(res?.data?.columns) ? res.data.columns : [];
      const users = (Array.isArray(res?.data?.related_users) ? res.data.related_users : []).map(user => new User(user));
      const targetColumns = formatColumns({ type: connectionType }, sourceColumns, { collaborators: users });
      setColumns(targetColumns);
      setRelatedUsers(users);
      setDueDate(ticket?.due_date || '');
      setAssigneeId('');
      setLabelIds([]);

      if (isGeneral) {
        setPriority(convertGeneralPriority(ticket?.priority, targetColumns));
        setStatus(convertGeneralStatus(targetColumns));
        let nextAssignees = Array.isArray(ticket?.assignees) ? ticket.assignees : [];
        setAssignees(nextAssignees.filter(assignee => assignee && users.find(user => user.email === assignee)));
      } else if (isJira) {
        const typeColumn = getColumnByName(targetColumns, CONNECTION_PREDEFINED_COLUMN_NAME.ISSUE_TYPE);
        const typeOptions = getColumnOptions(typeColumn);
        setIssueType(typeOptions.find(option => (option.name || '').toLowerCase() === 'task')?.id || typeOptions[0]?.id || '');
        setExternalPriority(findJiraPriority(ticket?.priority, getColumnByName(targetColumns, CONNECTION_PREDEFINED_COLUMN_NAME.PRIORITY)));
      } else if (isLinear) {
        setLinearState('');
        setExternalPriority(convertLinearPriority(ticket?.priority));
      }
      setIsLoading(false);
    }).catch((error) => {
      if (!axios.isCancel(error)) toaster.danger(Utils.getErrorMsg(error));
      setIsLoading(false);
    }).finally(() => {
      abortControllerRef.current = null;
    });
  }, [projectUuid, connectionId, connectionType, isGeneral, isJira, isLinear, ticket]);

  const dialogTitle = isJira ? gettext('Create Jira task') : isLinear ? gettext('Create Linear task') : gettext('Create task');
  const isSubmitDisabled = targetConnections.length === 0 || !title.trim() || isSubmitting || isLoading || (isJira && !issueType);

  return (
    <Modal className="seaqa-create-task-dialog" isOpen={true} toggle={onClose}>
      <ModalHeader toggle={onClose}>{dialogTitle}</ModalHeader>
      <ModalBody className="seaqa-create-task-dialog-body">
        <div className="seaqa-create-task-main-settings">
          <FormGroup>
            <Label for="devTaskTitle">{gettext('Title')}<span className="required-tip" title={gettext('Required')}>{'*'}</span></Label>
            <Input type="text" id="devTaskTitle" value={title} readOnly={isSubmitting} onChange={event => setTitle(event.target.value)} className="mb-4" />
          </FormGroup>
          <FormGroup>
            <Label for="devTaskContent">{gettext('Content')}</Label>
            <Input className="seaqa-task-content" type="textarea" id="devTaskContent" value={content} readOnly={isSubmitting} onChange={event => setContent(event.target.value)} />
          </FormGroup>
        </div>
        <div className="seaqa-create-task-other-settings">
          <div className="seaqa-settings-item mb-4">
            <CustomizeLabel icon="connection">
              {gettext('Connection')}
            </CustomizeLabel>
            <CustomizeSelect
              className="mb-2"
              value={connectionId}
              options={connectionOptions}
              onChange={setConnectionId}
              disabled={isSubmitting}
              placeholder={gettext('Select a connection')}
              searchable={true}
              searchPlaceholder={gettext('Search connections')}
              noOptionsPlaceholder={gettext('No connections available')}
              isInModal={true}
            />
          </div>
          {isGeneral && (
            <>
              <SingleSelectSettings id="status-editor-popover" isReadonly={isSubmitting || isLoading} value={status} column={statusColumn} onChange={setStatus} />
              <SingleSelectSettings id="priority-editor-popover" isReadonly={isSubmitting || isLoading} value={priority} column={priorityColumn} onChange={setPriority} />
              <SingleSelectSettings id="size-editor-popover" isReadonly={isSubmitting || isLoading} value={size} column={sizeColumn} onChange={setSize} />
              <CollaboratorsSettings id="assignees-editor-popover" isReadonly={isSubmitting || isLoading} title={gettext('Assignees')} tip={gettext('No one assigned')} value={assignees} useCollaborators={() => ({ collaborators: [], ...assigneesColumn?.data })} onChange={setAssignees} />
              <TextSettings isReadonly={isSubmitting || isLoading} column={versionColumn} value={version || ''} onChange={setVersion} />
            </>
          )}
          {isJira && (
            <>
              <SingleSelectSettings id="jira-issue-type-editor-popover" isReadonly={isSubmitting || isLoading} value={issueType} column={issueTypeColumn} onChange={setIssueType} />
              <SingleSelectSettings id="jira-priority-editor-popover" isReadonly={isSubmitting || isLoading} value={externalPriority} column={priorityColumn} onChange={setExternalPriority} />
              <CollaboratorsSettings
                id="jira-assignee-editor-popover"
                isReadonly={isSubmitting || isLoading}
                title={gettext('Assignee')}
                tip={gettext('No one assigned')}
                value={assigneeId ? [assigneeId] : []}
                useCollaborators={() => ({ collaborators: relatedUsers })}
                onChange={handleExternalAssigneeChange}
              />
            </>
          )}
          {isLinear && (
            <>
              <SingleSelectSettings id="linear-state-editor-popover" isReadonly={isSubmitting || isLoading} value={linearState} column={stateColumn} onChange={setLinearState} />
              <SingleSelectSettings id="linear-priority-editor-popover" isReadonly={isSubmitting || isLoading} value={externalPriority} column={linearPriorityColumn} onChange={setExternalPriority} />
              <CollaboratorsSettings
                id="linear-assignee-editor-popover"
                isReadonly={isSubmitting || isLoading}
                title={gettext('Assignee')}
                tip={gettext('No one assigned')}
                value={assigneeId ? [assigneeId] : []}
                useCollaborators={() => ({ collaborators: relatedUsers })}
                onChange={handleExternalAssigneeChange}
              />
              <LabelsSettings
                id="linear-labels-editor-popover"
                isReadonly={isSubmitting || isLoading}
                column={labelsColumn}
                value={labelIds}
                onChange={({ labels }) => setLabelIds(labels)}
              />
            </>
          )}
          <DueDateSettings isReadonly={isSubmitting || isLoading} value={dueDate} onChange={setDueDate} />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onClose}>{gettext('Cancel')}</Button>
        <Button color="primary" style={{ height: 38 }} onClick={handleSubmit} disabled={isSubmitDisabled}>
          {isSubmitting ? <CenteredLoading /> : gettext('Submit')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default CreateTaskDialog;
