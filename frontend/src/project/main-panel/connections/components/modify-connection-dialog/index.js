import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, Input, ModalBody, ModalFooter, FormGroup, Label, Alert, UncontrolledTooltip } from 'reactstrap';
import { gettext } from '@/constants';
import { validateName } from '@/utils/utils';
import { CONNECTION_FIELDS, CONNECTION_FIELD_TYPE } from '../../constants';
import { TextInput, PasswordInput, ModalHeader, Icon } from '@/components';

const ModifyConnectionDialog = ({ record, onSubmit, onToggle }) => {
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
    return customColumns.length > 0 ? customColumns.every(c => {
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
          const { key, type, can_edit_multiple_times = true, placeholder, helpText, defaultValue } = c;
          const value = config[key] !== undefined ? config[key] : (defaultValue || '');

          return (
            <FormGroup key={key}>
              <Label>
                {c.name}
                {c.is_required && (<span className="required-tip" title={gettext('Required')}>{'*'}</span>)}
                {helpText ? (
                  <>
                    <Icon
                      symbol="help"
                      id={`help-icon-${key}`}
                      className="mr-1 help-icon"
                      style={{ cursor: 'pointer' }}
                    />
                    <UncontrolledTooltip
                      target={`help-icon-${key}`}
                      placement="right"
                      fade={false}
                      className="sea-metadata-tooltip"
                    >
                      {helpText}
                    </UncontrolledTooltip>
                  </>
                ) : null}
              </Label>
              {type === CONNECTION_FIELD_TYPE.PASSWORD ? (
                <>
                  {!can_edit_multiple_times ? (
                    <Input value="********" disabled={true} />
                  ) : (
                    <PasswordInput value={value} enableCheckStrength={false} disabled={isSubmitting} onChange={(newValue) => onConfigChange(key, newValue)} />
                  )}
                </>
              ) : type === CONNECTION_FIELD_TYPE.NUMBER ? (
                <Input
                  type="number"
                  value={value}
                  placeholder={placeholder}
                  disabled={isSubmitting}
                  onChange={(e) => onConfigChange(key, parseInt(e.target.value) || defaultValue)}
                  min="1"
                  max="20"
                />
              ) : (
                <TextInput value={value} onChange={(newValue) => onConfigChange(key, newValue)} disabled={isSubmitting} />
              )}
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
