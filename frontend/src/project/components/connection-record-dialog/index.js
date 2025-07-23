import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, Input, ModalBody, ModalFooter, FormGroup, Label, Alert } from 'reactstrap';
import { gettext } from '../../../constants';
import CustomModalHeader from '../../../components/modal-header';
import { validateName } from '../../../utils/utils';
import { TABLE_COLUMN_TYPE } from '../../constants/table-column';
import PasswordInput from '../../../components/password-input';
import TextInput from './text-input';

const ConnectionRecordDialog = ({ fields, record, onSubmit, onToggle }) => {
  const [name, setName] = useState(record?.name || '');
  const [config, setConfig] = useState(record?.config || {});
  const [isChanged, setChanged] = useState(record ? false : true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const customFields = useMemo(() => fields.slice(1), [fields]);
  const nameColumn = useMemo(() => fields[0], [fields]);

  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    return customFields.length > 0 ? customFields.every(c => {
      if (c.is_required) return Boolean(config[c.key]);
      return true;
    }) : true;
  }, [name, config, customFields]);

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
    let validConfig = config;
    Object.keys(config).forEach((key) => {
      validConfig[key] = config[key] ? config[key].trim() : '';
    });
    onSubmit({ name: message, config: validConfig }, () => setSubmitting(false));
  }, [record, name, config, onSubmit, onToggle]);

  return (
    <Modal isOpen={true} toggle={onToggle} autoFocus={false}>
      <CustomModalHeader toggle={onToggle}>{record ? gettext('Edit record') : gettext('New record')}</CustomModalHeader>
      <ModalBody>
        <FormGroup>
          <Label>{nameColumn.name}</Label>
          <Input value={name} onChange={onNameChange} autoFocus disabled={isSubmitting} placeholder={nameColumn.placeholder || gettext('Please input name')} />
        </FormGroup>
        {customFields.map(c => {
          const { key, type, can_edit_multiple_times = true } = c;
          const value = config[key] || '';

          return (
            <FormGroup key={key}>
              <Label>
                {c.name}
                {c.is_required && (<span className="required-tip" title={gettext('Required')}>{'*'}</span>)}
              </Label>
              {type === TABLE_COLUMN_TYPE.PASSWORD ? (
                <>
                  {record && !can_edit_multiple_times ? (
                    <Input value="********" disabled={true} />
                  ) : (
                    <PasswordInput value={value} enableCheckStrength={false} disabled={isSubmitting} onChange={(newValue) => onConfigChange(key, newValue)} />
                  )}
                </>
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

ConnectionRecordDialog.propTypes = {
  fields: PropTypes.array.isRequired,
  record: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired
};

export default ConnectionRecordDialog;
