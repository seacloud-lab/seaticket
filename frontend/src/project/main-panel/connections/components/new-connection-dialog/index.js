import React, { useCallback, useMemo, useState } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { Button, Modal, Input, ModalBody, ModalFooter, FormGroup, Label, Tooltip } from 'reactstrap';
import { gettext, mediaUrl } from '@/constants';
import { CONNECTION_TYPES, CONNECTION_FIELDS, CONNECTION_FIELD_TYPE, CONNECTION_TYPE } from '../../constants';
import { TextInput, PasswordInput, ModalHeader, StepsNavigation, Icon } from '@/components';
import CopyInput from '@/components/copy-input';
import { STEP, STEPS } from './constants';

import './index.css';

const { server } = window.app.pageOptions;

const NewConnectionDialog = ({ onSubmit, onToggle, modifyConnection }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [type, setType] = useState(CONNECTION_TYPES[0].type);
  const [name, setName] = useState('');
  const [config, setConfig] = useState({});
  const [isSubmitting, setSubmitting] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState({});
  const [newRecord, setNewRecord] = useState(null);

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
    if (type === CONNECTION_TYPE.GITHUB_ISSUE) {
      if (!config.webhook_secret) {
        onToggle();
        return;
      }
      modifyConnection({ name: name.trim(), config }, () => {
        setSubmitting(false);
      },
      newRecord.id
      );
    } else {
      setSubmitting(true);
      onSubmit({ type, name: name.trim(), config }, () => {
        setSubmitting(false);
      });
    }
  }, [name, type, config, onSubmit, onToggle]);

  const handleSubmitGithub = useCallback(() => {
    setSubmitting(true);
    onSubmit({ type, name: name.trim(), config }, () => {
      setSubmitting(false);
    },
    true,
    (newRecord) => {
      setStepIndex(stepIndex + 1);
      setNewRecord(newRecord);
    }
    );
  }, [name, type, config, onSubmit, onToggle]);

  const step = STEPS[stepIndex];
  const typeOption = CONNECTION_TYPES.find(i => i.type === type);
  const isGithub = type === CONNECTION_TYPE.GITHUB_ISSUE;
  const customSteps = isGithub ? STEPS : [STEPS[0], STEPS[1]];

  return (
    <Modal isOpen={true} toggle={onToggle} autoFocus={false} className="sea-qa-project-new-connection-dialog">
      <ModalHeader toggle={onToggle}>{gettext('Add connection')}</ModalHeader>
      <ModalBody className="sea-qa-project-new-connection-body">
        <StepsNavigation
          className="sea-qa-project-new-connection-steps"
          steps={customSteps}
          currentIndex={stepIndex}
        />
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
              <Label>
                {gettext('Connection name')}
                <span className="required-tip" title={gettext('Required')}>{'*'}</span>
              </Label>
              <Input value={name} onChange={onNameChange} disabled={isSubmitting} />
            </FormGroup>
            {customColumns.map(c => {
              const { key, type, placeholder, helpText } = c;
              const value = config[key] || '';
              const toggleTooltip = () => {
                setTooltipOpen(prev => ({
                  ...prev,
                  [key]: !prev[key]
                }));
              };
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
                        <Tooltip
                          placement="top"
                          isOpen={tooltipOpen[key]}
                          target={`help-icon-${key}`}
                          toggle={toggleTooltip}
                        >
                          {helpText}
                        </Tooltip>
                      </>
                    ) : null}
                  </Label>
                  {type === CONNECTION_FIELD_TYPE.PASSWORD ? (
                    <PasswordInput value={value} placeholder={placeholder} enableCheckStrength={false} disabled={isSubmitting} onChange={(newValue) => onConfigChange(key, newValue)} />
                  ) : (
                    <TextInput placeholder={placeholder} value={value} onChange={(newValue) => onConfigChange(key, newValue)} disabled={isSubmitting} />
                  )}
                </FormGroup>
              );
            })}
          </div>
        )}
        {isGithub && step.key === STEP.GITHUB && (
          <div className="sea-qa-project-new-connection-config">
            <FormGroup>
              <Label>{gettext('Connection URL')}</Label>
              <CopyInput value={`${server}/webhook/github/connection_id=${newRecord.id}`} />
            </FormGroup>
            <FormGroup>
              <Label>{gettext('Webhook secret')}{' '}{gettext('(optional)')}</Label>
              <TextInput value={config['webhook_secret']} onChange={(newValue) => onConfigChange('webhook_secret', newValue)} />
            </FormGroup>
          </div>
        )}
      </ModalBody>
      {isGithub &&
      <ModalFooter>
        {stepIndex === 0 && (<Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>)}
        {stepIndex > 0 && stepIndex <= customSteps.length - 1 && (<Button color="secondary" onClick={() => setStepIndex(stepIndex - 1)}>{gettext('Previous')}</Button>)}
        {stepIndex === 0 && <Button color="primary" onClick={() => setStepIndex(stepIndex + 1)}>{gettext('Next')}</Button>}
        {stepIndex === 1 && <Button color="primary" onClick={handleSubmitGithub} disabled={isSubmitting}>{gettext('Next')}</Button>}
        {stepIndex === customSteps.length - 1 && <Button color="primary" onClick={handleSubmit}>{gettext('Submit')}</Button>}
      </ModalFooter>
      }
      {!isGithub &&
      <ModalFooter>
        {stepIndex === 0 && (<Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>)}
        {stepIndex > 0 && stepIndex <= customSteps.length - 1 && (<Button color="secondary" onClick={() => setStepIndex(stepIndex - 1)}>{gettext('Previous')}</Button>)}
        {stepIndex < customSteps.length - 1 && (<Button color="primary" onClick={() => setStepIndex(stepIndex + 1)}>{gettext('Next')}</Button>)}
        {stepIndex === customSteps.length - 1 && (<Button color="primary" onClick={handleSubmit} disabled={isSubmitting || !isValid || !name}>{gettext('Submit')}</Button>)}
      </ModalFooter>
      }
    </Modal>
  );
};

NewConnectionDialog.propTypes = {
  connection: PropTypes.object,
  connections: PropTypes.array,
  onSubmit: PropTypes.func.isRequired,
  modifyConnection: PropTypes.func,
  onToggle: PropTypes.func.isRequired
};

export default NewConnectionDialog;
