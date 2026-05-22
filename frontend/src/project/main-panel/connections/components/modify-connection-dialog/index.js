import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import copy from 'copy-to-clipboard';
import { Button, Modal, Input, ModalBody, ModalFooter, FormGroup, Label, Alert, Row } from 'reactstrap';
import { gettext } from '@/constants';
import { validateName } from '@/utils/validate';
import { CONNECTION_FIELDS, CONNECTION_FIELD_TYPE, CONNECTION_TYPE, EMAIL_SERVER_PROVIDER } from '../../constants';
import { getVisibleEmailFields, getEmailProvider, populateEmailOAuthDefaults, sanitizeEmailConfigByProvider, getEmailOAuthCallbackUrl, isOAuthEmailProvider } from '../../utils';
import { ModalHeader, toaster } from '@/components';
import ConnectionConfigEditor from '../connection-config-editor';

import '../new-connection-dialog/index.css';

const withEditReadonlyDefaults = (fields) => {
  return fields.map((field) => {
    if (field.type !== CONNECTION_FIELD_TYPE.GROUP) {
      return {
        is_edit_readonly: false,
        ...field,
      };
    }

    return {
      is_edit_readonly: false,
      ...field,
      children: field.children.map((child) => ({
        is_edit_readonly: false,
        ...child,
      })),
    };
  });
};

const ModifyConnectionDialog = ({ record, onSubmit, onToggle }) => {
  const [name, setName] = useState(record?.name || '');
  const [config, setConfig] = useState(record?.config || {});
  const [isChanged, setChanged] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showEmailAdvancedOptions, setShowEmailAdvancedOptions] = useState(false);

  const type = useMemo(() => record.type, [record]);
  const columns = useMemo(() => {
    const _columns = CONNECTION_FIELDS[type] || [];
    if (type === CONNECTION_TYPE.GITHUB_ISSUE) return withEditReadonlyDefaults(_columns.filter(c => c.key !== 'repository'));
    if (type === CONNECTION_TYPE.EMAIL) return withEditReadonlyDefaults(getVisibleEmailFields(_columns, getEmailProvider(config), showEmailAdvancedOptions));
    return withEditReadonlyDefaults(_columns);
  }, [type, config, showEmailAdvancedOptions]);
  const customColumns = useMemo(() => columns.filter(c => {
    if (c.type === CONNECTION_FIELD_TYPE.GROUP) return c.children.find(children => children.is_custom);
    return c.is_custom;
  }), [columns]);
  const isMicrosoftEmailProvider = useMemo(() => {
    return type === CONNECTION_TYPE.EMAIL && getEmailProvider(config) === EMAIL_SERVER_PROVIDER.MICROSOFT;
  }, [type, config]);
  const basicCustomColumns = useMemo(() => {
    return customColumns.filter(column => !column.is_advanced_option);
  }, [customColumns]);
  const advancedCustomColumns = useMemo(() => {
    return customColumns.filter(column => column.is_advanced_option);
  }, [customColumns]);
  const callbackUrl = useMemo(() => getEmailOAuthCallbackUrl(window.app.pageOptions.projectUuid), []);
  const isOAuthEmail = useMemo(() => {
    return type === CONNECTION_TYPE.EMAIL && isOAuthEmailProvider(getEmailProvider(config));
  }, [type, config]);

  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    return customColumns.length > 0 ? customColumns.every(c => {
      if (c.type === CONNECTION_FIELD_TYPE.GROUP) {
        return c.children.every(child => {
          if (child.is_required) return Boolean(config[child.key]);
          return true;
        });
      }
      if (c.is_required) return Boolean(config[c.key]);
      return true;
    }) : true;
  }, [name, config, customColumns]);

  const onNameChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === name) return;
    setName(newValue);
    setChanged(true);
  }, [name]);

  const onConfigChange = useCallback((key, value) => {
    if (config[key] === value) return;

    if (key === 'server_provider') {
      const nextProvider = value || EMAIL_SERVER_PROVIDER.GENERAL;
      setConfig(populateEmailOAuthDefaults({ ...config, [key]: nextProvider }, nextProvider));
      setShowEmailAdvancedOptions(false);
      setChanged(true);
      return;
    }

    setConfig({ ...config, [key]: value });
    setChanged(true);
  }, [config]);

  const handleSubmit = useCallback(() => {
    const { isValid, message } = validateName(name);
    if (!isValid) {
      setErrorMsg(message);
      return;
    }
    setSubmitting(true);
    let validConfig = { ...config };
    let connectionFields = CONNECTION_FIELDS[record.type] || [];
    if (record.type === CONNECTION_TYPE.EMAIL) {
      validConfig = sanitizeEmailConfigByProvider(validConfig);
      connectionFields = getVisibleEmailFields(connectionFields, getEmailProvider(config), showEmailAdvancedOptions).reduce((acc, item) => {
        if (item.type === CONNECTION_FIELD_TYPE.GROUP) {
          return [...acc, ...item.children];
        } else {
          return [...acc, item];
        }
      }, []);
    }

    Object.keys(validConfig).forEach((key) => {
      const field = connectionFields.find(f => f.key === key);
      const fieldType = field?.type;

      if (fieldType === CONNECTION_FIELD_TYPE.NUMBER) {
        validConfig[key] = validConfig[key] ? parseInt(validConfig[key], 10) : '';
      } else if (fieldType === CONNECTION_FIELD_TYPE.SELECT) {
        validConfig[key] = validConfig[key] || '';
      } else if (typeof validConfig[key] === 'string') {
        validConfig[key] = validConfig[key] ? validConfig[key].trim() : '';
      }
    });
    onSubmit({ name, config: validConfig }, () => setSubmitting(false));
  }, [record, name, config, onSubmit, onToggle]);

  const renderConnectionField = useCallback((column) => {
    const { type, key, children, is_edit_readonly } = column;
    if (type === CONNECTION_FIELD_TYPE.GROUP) {
      return (
        <Row className="mx-0 seaqa-project-connection-group-config" key={key}>
          {children.map((child, index) => (
            <ConnectionConfigEditor
              key={`${key}-${index}`}
              column={child}
              className="mx-0 px-0 width-half"
              row={config}
              readonly={isSubmitting || child.is_edit_readonly}
              canModifyPassword={false}
              onChange={onConfigChange}
            />
          ))}
        </Row>
      );
    }

    return (
      <ConnectionConfigEditor
        column={column}
        key={key}
        row={config}
        readonly={isSubmitting || is_edit_readonly}
        canModifyPassword={false}
        onChange={onConfigChange}
      />
    );
  }, [config, isSubmitting, onConfigChange]);

  const onCopyCallbackUrl = useCallback(() => {
    copy(callbackUrl);
    toaster.success(gettext('Connection URL has been copied to clipboard'), { duration: 2 });
  }, [callbackUrl]);

  return (
    <Modal isOpen={true} toggle={onToggle} autoFocus={false} className="seaqa-project-connection-dialog" >
      <ModalHeader toggle={onToggle}>{gettext('Edit connection')}</ModalHeader>
      <ModalBody className="seaqa-project-connection-body">
        <FormGroup>
          <Label>
            {gettext('Connection name')}
            <span className="required-tip" title={gettext('Required')}>{'*'}</span>
          </Label>
          <Input value={name} onChange={onNameChange} autoFocus disabled={isSubmitting} />
        </FormGroup>
        {basicCustomColumns.map(renderConnectionField)}
        {isOAuthEmail && (
          <FormGroup>
            <Label>{gettext('OAuth callback URL')}</Label>
            <div className="seaqa-project-connection-oauth-tip">{gettext('Use this callback URL in your email provider OAuth app configuration. It is read-only and must match exactly.')}</div>
            <div className="input-group">
              <Input value={callbackUrl} disabled={true} />
              <div className="input-group-append">
                <Button type="button" onClick={onCopyCallbackUrl}>{gettext('Copy')}</Button>
              </div>
            </div>
          </FormGroup>
        )}
        {isMicrosoftEmailProvider && (
          <div className="seaqa-project-connection-advanced-options">
            <Button
              type="button"
              color="secondary"
              outline
              className="seaqa-project-connection-advanced-options-btn"
              onClick={() => setShowEmailAdvancedOptions(!showEmailAdvancedOptions)}
            >
              <span>{gettext('Advanced options')}</span>
              <i className={`dtable-font dtable-icon-down3 ml-2 ${showEmailAdvancedOptions ? 'seaqa-project-connection-advanced-options-icon-expanded' : ''}`} />
            </Button>
          </div>
        )}
        {advancedCustomColumns.map(renderConnectionField)}
        {errorMsg && (<Alert color="danger">{errorMsg}</Alert>)}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={handleSubmit} disabled={isSubmitting || !isValid || !isChanged}>{gettext('Submit')}</Button>
      </ModalFooter>
    </Modal>
  );
};

ModifyConnectionDialog.propTypes = {
  record: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired
};

export default ModifyConnectionDialog;
