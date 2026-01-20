import { useState, useEffect } from 'react';
import { Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Label, Input } from 'reactstrap';
import { getPreviewContent } from '@seafile/seafile-editor';
import { ticketsAPI } from '@/project/api';
import { gettext } from '@/constants';
import { toaster, ModalHeader, CenteredLoading } from '@/components';
import { CollaboratorsSettings, TagsSettings, TypeSettings, RateSettings } from '../../../tickets/components/ticket-settings';
import { useMetadata } from '../../../tickets/hooks';
import { getRowById, getRowsByIds } from '@/sea-metadata/utils/row';
import { TICKET_STATE, TICKET_TABLE_NAME } from '@/project/main-panel/tickets/constants';
import { useData } from '@/project/hooks';

import './index.css';

const CreateTicketDialog = ({ initialData, isOpen, toggle, isLoading, projectUuid }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [type, setType] = useState('');
  const [tags, setTags] = useState([]);
  const [priority, setPriority] = useState(0);

  const { typesData, tagsData, substatesData, createTag } = useMetadata();
  const { insertRow } = useData();

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setContent(initialData.content || '');
      setAssignees(initialData.assignees || []);
      setType(initialData.type || '');
      setTags(initialData.tags || []);
      setPriority(initialData.priority || 0);
    } else {
      setTitle('');
      setContent('');
      setAssignees([]);
      setType('');
      setTags([]);
      setPriority(0);
    }
  }, [initialData]);

  const handleSubmit = () => {
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
    let validTags = tags;
    if (Array.isArray(validTags) && validTags.length > 0) {
      validTags = getRowsByIds(tagsData, validTags);
      validTags = validTags.map(tag => tag.name);
    }

    const substateOptions = substatesData.rows.filter(r => r.parent_id === TICKET_STATE.OPEN);
    const substateOption = substateOptions[0];

    const ticketData = {
      title,
      content: ticket_content,
      type: validType,
      assignees,
      tags: validTags,
      priority,
      substate: substateOption?.name,
    };
    ticketsAPI.createProjectTicket(projectUuid, ticketData).then((res) => {
      toaster.success(gettext('Ticket created'));
      toggle();
      insertRow(TICKET_TABLE_NAME);
    });
  };

  return (
    <Modal className="sea-qa-create-ticket-dialog" isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>{gettext('Create related ticket')}</ModalHeader>
      <ModalBody>
        {isLoading && <CenteredLoading/>}
        {!isLoading && (
          <div className="d-flex">
            <div className="sea-qa-create-ticket-dialog-left-settings">
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
                    className="sea-qa-ticket-content"
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
            <div className="sea-qa-create-ticket-dialog-other-settings">
              <RateSettings isReadonly={isLoading} value={priority} onChange={setPriority} />
              <CollaboratorsSettings isReadonly={isLoading} title={gettext('Assignees')} value={assignees} onChange={setAssignees} />
              <TagsSettings
                isReadonly={isLoading}
                value={tags}
                tagsData={tagsData}
                createTag={createTag}
                onChange={setTags}
              />
              <TypeSettings isReadonly={isLoading} value={type} onChange={setType} />
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={toggle}>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={handleSubmit} disabled={isLoading || !title.trim()}>{gettext('Submit')}</Button>
      </ModalFooter>
    </Modal>
  );
};

export default CreateTicketDialog;
