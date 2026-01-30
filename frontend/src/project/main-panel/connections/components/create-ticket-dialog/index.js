import { useState, useEffect } from 'react';
import { Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Label, Input } from 'reactstrap';
import { getPreviewContent } from '@seafile/seafile-editor';
import { ticketsAPI, connectionsAPI } from '@/project/api';
import { gettext } from '@/constants';
import { toaster, ModalHeader, CenteredLoading, CenteredError } from '@/components';
import { CollaboratorsSettings, TagsSettings, TypeSettings, RateSettings } from '../../../tickets/components/ticket-settings';
import { getRowById } from '@/sea-metadata/utils/row';
import { TICKET_STATE, TICKET_TABLE_NAME } from '@/project/main-panel/tickets/constants';
import { useData, useMetadata, useTags } from '@/project/hooks';
import { Utils } from '@/utils/utils';

import './index.css';

const CreateTicketDialog = ({ projectUuid, row, relatedUrl, connection, onClose }) => {
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrMessage] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [type, setType] = useState('');
  const [tags, setTags] = useState([]);
  const [priority, setPriority] = useState(0);

  const { typesData, substatesData } = useMetadata();
  const { tagsData, createTag } = useTags();
  const { insertRow } = useData();

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
      validTags = validTags.map(tag => Number(tag));
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
      onClose();
      insertRow(TICKET_TABLE_NAME);
    });
  };

  useEffect(() => {
    setLoading(true);
    connectionsAPI.convertRecordToTicket(projectUuid, connection.id, row._id).then(res => {
      let { title, content, assignees, type, tags, priority } = { title: '', content: '', assignees: [], type: '', tags: [], priority: 0, ...res?.data };
      const suffix = `${gettext('Related record')}: ${relatedUrl}`;
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
  }, []);

  return (
    <Modal className="sea-qa-create-ticket-dialog" isOpen={true} toggle={onClose}>
      <ModalHeader toggle={onClose}>{gettext('Create related ticket')}</ModalHeader>
      <ModalBody>
        {isLoading && <CenteredLoading/>}
        {!isLoading && errorMessage && (<CenteredError>{errorMessage}</CenteredError>)}
        {!isLoading && !errorMessage && (
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
        <Button color="secondary" onClick={onClose}>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={handleSubmit} disabled={isLoading || !title.trim()}>{gettext('Submit')}</Button>
      </ModalFooter>
    </Modal>
  );
};

export default CreateTicketDialog;
