import { useState, useEffect } from 'react';
import { Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Label, Input } from 'reactstrap';
import { getPreviewContent } from '@seafile/seafile-editor';
import { portalAPI } from '@/portal/api';
import { ticketsAPI } from '@/project/api';
import { gettext } from '@/constants';
import { toaster, ModalHeader, CenteredLoading, CenteredError } from '@/components';
import { CollaboratorsSettings, TypeSettings, PrioritySettings } from '../../../tickets/components/ticket-settings';
import { getRowById } from '@/sea-metadata/utils/row';
import { TICKET_STATE, TICKET_TABLE_NAME } from '@/project/main-panel/tickets/constants';
import { useMetadata, useTags, useData } from '@/project/hooks';
import { Utils } from '@/utils/utils';
import TagsSettings from '@/project/main-panel/tags/tags-settings';
import context from '@/sea-metadata/context';
import { EVENT_BUS_TYPE as SEA_METADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { PORTAL_ISSUE_TABLE_NAME, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME } from '../../constants';
import { getColumnByName } from '@/sea-metadata/utils/column';

import '@/project/main-panel/connections/components/create-ticket-dialog/index.css';

const CreateTicketDialog = ({ projectUuid, row, columns, onClose }) => {
  const [isLoading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrMessage] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [type, setType] = useState('');
  const [tags, setTags] = useState([]);
  const [priority, setPriority] = useState(0);

  const { typesData, substatesData } = useMetadata();
  const { tagsData, createTag } = useTags();
  const { insertRowByLink } = useData();

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

    const substateOptions = substatesData.rows.filter(r => r.parent_id === TICKET_STATE.OPEN);
    const substateOption = substateOptions[0];

    const ticketData = {
      title,
      content: ticket_content,
      type: validType,
      assignees,
      tags,
      priority,
      substate: substateOption?.name,
      linked_connection_records: [`portal_${row._pk}`],
    };
    ticketsAPI.createProjectTicket(projectUuid, ticketData).then((res) => {
      toaster.success(gettext('Ticket created'));
      onClose();
      const linkedUpdateRecord = {
        [res.data.ticket._pk]: res.data.ticket.title,
      };
      const linkColumn = getColumnByName(columns, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.LINKED_TICKET);
      const rowUpdateData = { [linkColumn.key]: [res.data.ticket._pk] };
      insertRowByLink(TICKET_TABLE_NAME, PORTAL_ISSUE_TABLE_NAME, linkedUpdateRecord, row._id, rowUpdateData, () => {
        const eventBus = context.eventBus;
        eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, row._id, rowUpdateData);
        eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, { linked_records: linkedUpdateRecord }, false);
      });

    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setErrMessage(errorMessage);
    }).finally(() => {
      setIsSubmitting(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    portalAPI.convertPortalIssueToTicket(projectUuid, row._pk).then(res => {
      let { title, content, related_url } = { title: '', content: '', related_url: '', ...res?.data };
      const suffix = `${gettext('Related record')}: ${related_url || ''}`;
      const initContent = content ? `${content}\n\n${suffix}` : suffix;
      setTitle(title || '');
      setContent(initContent || '');
      setAssignees([]);
      setType('');
      setTags([]);
      setPriority(0);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setErrMessage(errorMessage);
    }).finally(() => {
      setLoading(false);
    });
  }, [projectUuid, row._pk]);

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
              <PrioritySettings isReadonly={isLoading} value={priority} onChange={setPriority} />
              <CollaboratorsSettings isReadonly={isLoading} title={gettext('Assignees')} value={assignees} onChange={setAssignees} />
              <TagsSettings
                isReadonly={isLoading}
                value={tags}
                tagsData={tagsData}
                createTag={createTag}
                onChange={setTags}
              />
              <TypeSettings isReadonly={isLoading} value={type} onChange={setType} useMetadataContext={useMetadata} />
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
