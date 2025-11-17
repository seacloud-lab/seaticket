import { useState, useEffect } from 'react';
import { Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Label, Input } from 'reactstrap';
import { getPreviewContent } from '@seafile/seafile-editor';
import { ticketsAPI } from '@/project/api';
import { gettext } from '@/constants';
import { toaster, ModalHeader, CenteredLoading } from '@/components';
import { CollaboratorsSettings, TagsSettings, TypeSettings, RateSettings } from '../../../tickets/components/ticket-settings';

import './index.css';

const CreateTicketDialog = ({ initialData, isOpen, toggle, isLoading, projectUuid }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [type, setType] = useState('');
  const [tags, setTags] = useState([]);
  const [priority, setPriority] = useState(0);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setAssignees(initialData.assignees || []);
      setType(initialData.type || '');
      setTags(initialData.tags || []);
      setPriority(initialData.priority || 0);
    } else {
      setTitle('');
      setDescription('');
      setAssignees([]);
      setType('');
      setTags([]);
      setPriority(0);
    }
  }, [initialData]);

  const handleSubmit = () => {
    const { previewText, images, links, checklist } = getPreviewContent(description);
    const content = {
      text: description,
      preview: previewText,
      images,
      links,
      checklist,
    };
    const ticketData = {
      title,
      description: content,
      type,
      assignees,
      tags,
      priority,
    };
    ticketsAPI.createProjectTicket(projectUuid, ticketData).then(() => {
      toaster.success(gettext('Ticket created'));
      setTimeout(toggle, 500);
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
                  <Label for="ticketDescription">{gettext('Description')}</Label>
                  <Input
                    className="sea-qa-ticket-description"
                    type="textarea"
                    name="description"
                    id="ticketDescription"
                    value={description}
                    readOnly={isLoading}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </FormGroup>
              </Form>
            </div>
            <div className="sea-qa-create-ticket-dialog-other-settings">
              <RateSettings isReadonly={isLoading} value={priority} onChange={setPriority} />
              <CollaboratorsSettings isReadonly={isLoading} title={gettext('Assignees')} value={assignees} onChange={setAssignees} />
              <TagsSettings isReadonly={isLoading} value={tags} onChange={setTags} />
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
