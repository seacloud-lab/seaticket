import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, Input, ModalBody, ModalFooter, FormGroup, Label } from 'reactstrap';
import classnames from 'classnames';
import { gettext, mediaUrl } from '../../../constants';
import { CONNECTION_TYPES, CONNECTION_FIELDS, TABLE_COLUMN_TYPE } from '../../constants';
import { TextInput, PasswordInput, ModalHeader, StepsNavigation } from '../../../components';

import './index.css';

const STEP = {
  TYPE: 'type',
  CONFIG: 'config',
};

const STEPS = [
  { key: STEP.TYPE, name: gettext('Select connection type') },
  { key: STEP.CONFIG, name: gettext('Fill in connection details') },
];

const NewConnectionDialog = ({ onSubmit, onToggle }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [type, setType] = useState(CONNECTION_TYPES[0].type);
  const [name, setName] = useState('');
  const [config, setConfig] = useState({});
  const [isSubmitting, setSubmitting] = useState(false);

  const columns = useMemo(() => CONNECTION_FIELDS[type] || [], [type]);
  const customColumns = useMemo(() => columns.filter(c => c.is_custom), [columns]);
  const nameColumn = useMemo(() => columns[0], [columns]);

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
  }, [name]);

  const onTypeChange = useCallback((newType) => {
    if (type === newType) return;
    setConfig({});
    setType(newType);
  }, [type]);

  const onConfigChange = useCallback((key, value) => {
    if (config[key] === value) return;
    setConfig({ ...config, [key]: value });
  }, [config]);

  const handleSubmit = useCallback(() => {
    setSubmitting(true);
    onSubmit({ type, name: name.trim(), config }, () => {
      setSubmitting(false);
    });
  }, [name, type, config, onSubmit, onToggle]);

  const step = STEPS[stepIndex];
  const typeOption = CONNECTION_TYPES.find(i => i.type === type);

  return (
    <Modal isOpen={true} toggle={onToggle} autoFocus={false} className="sea-qa-project-new-connection-dialog">
      <ModalHeader toggle={onToggle}>{gettext('Add connection')}</ModalHeader>
      <ModalBody className="sea-qa-project-new-connection-body">
        <StepsNavigation className="sea-qa-project-new-connection-steps" steps={STEPS} currentIndex={stepIndex} />
        {step.key === STEP.TYPE && (
          <div className="sea-qa-project-new-connection-types">
            {CONNECTION_TYPES.map(connection => {
              const { type: key, name, icon } = connection;
              const isActive = key === type;
              return (
                <div className={classnames('sea-qa-project-new-connection-type', { 'selected': isActive })} key={key} onClick={() => onTypeChange(key)}>
                  <img src={`${mediaUrl}img/connection/${icon}.png`} alt={name} className="sea-qa-project-new-connection-icon" />
                  <span className="sea-qa-project-new-connection-name">{name}</span>
                </div>
              );
            })}
          </div>
        )}
        {step.key === STEP.CONFIG && (
          <div className="sea-qa-project-new-connection-config">
            <FormGroup>
              <Label>{gettext('Connection type')}</Label>
              <Input value={typeOption.name} disabled />
            </FormGroup>
            <FormGroup>
              <Label>{nameColumn.name}</Label>
              <Input value={name} onChange={onNameChange} disabled={isSubmitting} placeholder={nameColumn.placeholder || gettext('Please input name')} />
            </FormGroup>
            {customColumns.map(c => {
              const { key, type } = c;
              const value = config[key] || '';
              return (
                <FormGroup key={key}>
                  <Label>
                    {c.name}
                    {c.is_required && (<span className="required-tip" title={gettext('Required')}>{'*'}</span>)}
                  </Label>
                  {type === TABLE_COLUMN_TYPE.PASSWORD ? (
                    <PasswordInput value={value} enableCheckStrength={false} disabled={isSubmitting} onChange={(newValue) => onConfigChange(key, newValue)} />
                  ) : (
                    <TextInput value={value} onChange={(newValue) => onConfigChange(key, newValue)} disabled={isSubmitting} />
                  )}
                </FormGroup>
              );
            })}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        {stepIndex === 0 && (<Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>)}
        {stepIndex > 0 && stepIndex <= STEPS.length - 1 && (<Button color="secondary" onClick={() => setStepIndex(stepIndex - 1)}>{gettext('Previous')}</Button>)}
        {stepIndex < STEPS.length - 1 && (<Button color="primary" onClick={() => setStepIndex(stepIndex + 1)}>{gettext('Next')}</Button>)}
        {stepIndex === STEPS.length - 1 && (<Button color="primary" onClick={handleSubmit} disabled={isSubmitting || !isValid || !name}>{gettext('Submit')}</Button>)}
      </ModalFooter>
    </Modal>
  );
};

NewConnectionDialog.propTypes = {
  connection: PropTypes.object,
  connections: PropTypes.array,
  onSubmit: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired
};

export default NewConnectionDialog;
