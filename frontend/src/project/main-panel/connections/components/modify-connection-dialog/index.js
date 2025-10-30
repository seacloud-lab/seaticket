import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, Input, ModalBody, ModalFooter, FormGroup, Label, Alert } from 'reactstrap';
import { gettext, GitHubAppURL } from '@/constants';
import { validateName } from '@/utils/validate';
import { CONNECTION_FIELDS, CONNECTION_FIELD_TYPE, CONNECTION_TYPE } from '../../constants';
import { TextInput, PasswordInput, ModalHeader, IconTooltip } from '@/components';
import GitHubIntegrationSelector from '../cell-editor/github-integration-selector';

const ModifyConnectionDialog = ({ record, githubOauth, projectUuid, onSubmit, onToggle }) => {
  const [name, setName] = useState(record?.name || '');
  const [config, setConfig] = useState(record?.config || {});
  const [isChanged, setChanged] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const type = useMemo(() => record.type, [record]);
  const columns = useMemo(() => CONNECTION_FIELDS[type] || [], [type]);
  const customColumns = useMemo(() => columns.filter(c => c.is_custom), [columns]);

  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    const isRequiredValid = customColumns.length > 0 ? customColumns.every(c => {
      if (c.is_required) return Boolean(config[c.key]);
      return true;
    }) : true;
    if (!isRequiredValid) return false;
    if (type !== CONNECTION_TYPE.GITHUB_ISSUE) return isRequiredValid;
    return config.access_token || config.installation_id;
  }, [name, type, config, customColumns]);

  const onNameChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === name) return;
    setName(newValue);
    setChanged(true);
  }, [name]);

  const onConfigChange = useCallback((key, value) => {
    if (config[key] === value) return;
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
    const connectionFields = CONNECTION_FIELDS[record.type] || [];

    Object.keys(config).forEach((key) => {
      const field = connectionFields.find(f => f.key === key);
      const fieldType = field?.type;

      if (fieldType === CONNECTION_FIELD_TYPE.NUMBER) {
        validConfig[key] = config[key] ? parseInt(config[key], 10) : '';
      } else {
        validConfig[key] = config[key] ? config[key].trim() : '';
      }
    });
    onSubmit({ name: message, config: validConfig }, () => setSubmitting(false));
  }, [record, name, config, onSubmit, onToggle]);

  const renderEditor = useCallback((column) => {
    const { key, type, placeholder, defaultValue, can_edit_multiple_times } = column;
    const value = config[key] !== undefined ? config[key] : (defaultValue || '');
    if (type === CONNECTION_FIELD_TYPE.PASSWORD) {
      return (
        <>
          {!can_edit_multiple_times ? (
            <Input value="********" disabled={true} />
          ) : (
            <PasswordInput value={value} enableCheckStrength={false} disabled={isSubmitting} onChange={(newValue) => onConfigChange(key, newValue)} />
          )}
        </>
      );
    }
    if (type === CONNECTION_FIELD_TYPE.NUMBER) {
      return (
        <Input
          type="number"
          value={value}
          placeholder={placeholder}
          disabled={isSubmitting}
          onChange={(e) => onConfigChange(key, parseInt(e.target.value) || defaultValue)}
          min="1"
          max="20"
        />
      );
    }
    if (type === CONNECTION_FIELD_TYPE.GITHUB_INSTALLATION) {
      return (
        <GitHubIntegrationSelector
          githubOauth={githubOauth}
          projectUuid={projectUuid}
          value={value}
          onChange={(newValue) => onConfigChange(key, newValue)}
        />
      );
    }
    return (
      <TextInput
        value={value}
        onChange={(newValue) => onConfigChange(key, newValue)}
        disabled={isSubmitting}
      />
    );
  }, [isSubmitting, config, githubOauth, projectUuid, onConfigChange]);

  return (
    <Modal isOpen={true} toggle={onToggle} autoFocus={false}>
      <ModalHeader toggle={onToggle}>{gettext('Edit connection')}</ModalHeader>
      <ModalBody>
        <FormGroup>
          <Label>
            {gettext('Connection name')}
            <span className="required-tip" title={gettext('Required')}>{'*'}</span>
          </Label>
          <Input value={name} onChange={onNameChange} autoFocus disabled={isSubmitting} />
        </FormGroup>
        {customColumns.map(c => {
          const { key, type: columnType, helpText } = c;

          return (
            <FormGroup key={key}>
              <Label>
                {c.name}
                {c.is_required && (<span className="required-tip" title={gettext('Required')}>{'*'}</span>)}
                {helpText && (<IconTooltip tip={helpText} className={c.is_required ? 'ml-0' : ''} />)}
                {githubOauth && columnType === CONNECTION_FIELD_TYPE.GITHUB_INSTALLATION && (
                  <IconTooltip
                    icon="github"
                    tip={gettext('Jump to GitHub app')}
                    className="ml-0"
                    onClick={() => window.open(GitHubAppURL, '_blank', 'noopener,noreferrer')}
                  />
                )}
              </Label>
              {renderEditor(c)}
            </FormGroup>
          );
        })}
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
