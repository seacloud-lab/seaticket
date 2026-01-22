import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import copy from 'copy-to-clipboard';
import { Button, Modal, ModalBody, ModalFooter, FormGroup, Label, Input, InputGroup } from 'reactstrap';
import { gettext } from '@/constants';
import { CONNECTION_TYPE } from '../../constants';
import { ModalHeader, TextInput, IconButton, toaster } from '@/components';

import '../new-connection-dialog/index.css';

const { server } = window.app.pageOptions;

const ConfigureWebhookDialog = ({ record, onSubmit, onToggle }) => {
  const [connectionUrl, setConnectionUrl] = useState(record?.config?.webhook_url || '');
  const [webhookSecret, setWebhookSecret] = useState(record?.config?.webhook_secret || '');
  const [isSubmitting, setSubmitting] = useState(false);

  const defaultConnectionUrl = useMemo(() => {
    if (!record) return '';
    if (record.type === CONNECTION_TYPE.GITHUB_ISSUE) {
      return `${server}/webhook/github/?connection_id=${record.id}`;
    }
    if (record.type === CONNECTION_TYPE.DISCOURSE_FORUM) {
      return `${server}/webhook/discourse/?connection_id=${record.id}`;
    }
    return '';
  }, [record]);

  const onConnectionUrlChange = useCallback((event) => {
    setConnectionUrl(event.target.value);
  }, []);

  const onWebhookSecretChange = useCallback((newValue) => {
    setWebhookSecret(newValue);
  }, []);

  const copyConnectionUrl = useCallback(() => {
    const urlToCopy = connectionUrl || defaultConnectionUrl;
    copy(urlToCopy);
    toaster.success(gettext('Connection URL has been copied to clipboard'), { duration: 2 });
  }, [connectionUrl, defaultConnectionUrl]);

  const handleSubmit = useCallback(() => {
    setSubmitting(true);
    const updatedConfig = {
      ...record.config,
      webhook_url: connectionUrl.trim(),
      webhook_secret: webhookSecret.trim()
    };
    onSubmit({ name: record.name, config: updatedConfig }, () => {
      setSubmitting(false);
    });
  }, [record, connectionUrl, webhookSecret, onSubmit]);

  return (
    <Modal isOpen={true} toggle={onToggle} autoFocus={false} className="sea-qa-project-connection-dialog">
      <ModalHeader toggle={onToggle}>{gettext('Configure webhook')}</ModalHeader>
      <ModalBody className="sea-qa-project-connection-body">
        <FormGroup>
          <Label>{gettext('Connection URL')}</Label>
          <InputGroup>
            <Input
              value={connectionUrl}
              onChange={onConnectionUrlChange}
              placeholder={defaultConnectionUrl}
              disabled={isSubmitting}
            />
            <Button onClick={copyConnectionUrl}>
              <IconButton disabled={true} icon="copy" className="p-0" />
            </Button>
          </InputGroup>
        </FormGroup>
        <FormGroup>
          <Label>{gettext('Webhook secret (optional)')}</Label>
          <TextInput
            value={webhookSecret}
            onChange={onWebhookSecretChange}
            disabled={isSubmitting}
          />
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={handleSubmit} disabled={isSubmitting}>{gettext('Submit')}</Button>
      </ModalFooter>
    </Modal>
  );
};

ConfigureWebhookDialog.propTypes = {
  record: PropTypes.object.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired
};

export default ConfigureWebhookDialog;
