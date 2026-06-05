import { useEffect, useState } from 'react';
import { Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Label, Input } from 'reactstrap';
import { gettext } from '@/constants';
import { toaster, ModalHeader, CenteredLoading, CenteredError } from '@/components';
import { ticketsAPI, knowledgeBaseAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import { useData } from '@/project/hooks';
import { KB_TABLE_NAME } from '@/project/main-panel/knowledge-base/constants';

const CreateKBRecordDialog = ({ projectUuid, ticket, onClose }) => {
  const [isLoading, setLoading] = useState(true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [errorMessage, setErrMessage] = useState('');

  const [kbTitle, setKBTitle] = useState('');
  const [kbContent, setKBContent] = useState('');
  const { markTablesViewExpired } = useData();

  useEffect(() => {
    const ticketTitle = ticket?.title || '';
    const ticketContent = ticket?.content || '';
    const ticketId = ticket?._id;

    setLoading(true);
    setErrMessage('');

    const commentsPromise = ticketId ? ticketsAPI.listProjectTicketComments(projectUuid, ticketId, 1, 25).then(res => {
      const ticketComments = res?.data?.ticket_comments || [];
      return ticketComments.map(c => {
        return {
          creator: c?.creator || '',
          created_time: c?.created_time || '',
          content: c?.content || '',
        };
      }).filter(c => c.content);
    }).catch(() => []) : Promise.resolve([]);

    commentsPromise.then((ticketComments) => {
      return ticketsAPI.convertTicketToKnowledgeBaseRecord(projectUuid, ticketTitle, ticketContent, ticketComments);
    }).then(res => {
      const { kb_title, kb_content } = res?.data || {};
      setKBTitle(kb_title || ticketTitle || '');
      setKBContent(kb_content || ticketContent || '');
    }).catch(error => {
      const msg = Utils.getErrorMsg(error);
      setErrMessage(msg);
    }).finally(() => {
      setLoading(false);
    });
  }, [projectUuid, ticket]);

  const handleSubmit = () => {
    if (isSubmitting) return;
    setSubmitting(true);

    knowledgeBaseAPI.createRecord(projectUuid, {
      title: kbTitle.trim(),
      content: kbContent.trim(),
    }).then((res) => {
      markTablesViewExpired([KB_TABLE_NAME]);
      toaster.success(gettext('Record created'));
      onClose();
    }).catch(error => {
      const msg = Utils.getErrorMsg(error);
      toaster.danger(msg);
      setSubmitting(false);
    });
  };

  return (
    <Modal isOpen={true} toggle={onClose}>
      <ModalHeader toggle={onClose}>{gettext('Create knowledge base record')}</ModalHeader>
      <ModalBody>
        {isLoading && <CenteredLoading />}
        {!isLoading && errorMessage && (<CenteredError>{errorMessage}</CenteredError>)}
        {!isLoading && !errorMessage && (
          <Form>
            <FormGroup>
              <Label for="kbTitle">
                {gettext('Title')}
                <span className="required-tip" title={gettext('Required')}>{'*'}</span>
              </Label>
              <Input
                type="text"
                id="kbTitle"
                value={kbTitle}
                onChange={(e) => setKBTitle(e.target.value)}
              />
            </FormGroup>
            <FormGroup>
              <Label for="kbContent">
                {gettext('Content')}
                <span className="required-tip" title={gettext('Required')}>{'*'}</span>
              </Label>
              <Input
                type="textarea"
                id="kbContent"
                value={kbContent}
                onChange={(e) => setKBContent(e.target.value)}
                style={{ minHeight: '240px' }}
              />
            </FormGroup>
          </Form>
        )}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onClose}>{gettext('Cancel')}</Button>
        <Button
          color="primary"
          onClick={handleSubmit}
          disabled={isLoading || !!errorMessage || !kbTitle.trim() || !kbContent.trim() || isSubmitting}
        >
          {isSubmitting ? (<CenteredLoading />) : gettext('Submit')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default CreateKBRecordDialog;
