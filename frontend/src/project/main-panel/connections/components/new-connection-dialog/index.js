import React, { useCallback, useMemo, useState } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { Button, Modal, Input, ModalBody, ModalFooter, FormGroup, Label, Row } from 'reactstrap';
import { gettext } from '@/constants';
import { CONNECTION_TYPES, CONNECTION_FIELDS, CONNECTION_FIELD_TYPE, CONNECTION_TYPE } from '../../constants';
import { TextInput, ModalHeader, StepsNavigation } from '@/components';
import CopyInput from '@/components/copy-input';
import { STEP, STEPS } from './constants';
import ConnectionConfigEditor from '../connection-config-editor';
import { getConnectionIcon } from '../../utils';

import './index.css';

const { server } = window.app.pageOptions;

const NewConnectionDialog = ({ onSubmit, onToggle, modifyConnection }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [type, setType] = useState(CONNECTION_TYPES[0].type);
  const [name, setName] = useState('');
  const [config, setConfig] = useState({});
  const [isSubmitting, setSubmitting] = useState(false);
  const [newRecord, setNewRecord] = useState(null);

  const columns = useMemo(() => {
    const _columns = CONNECTION_FIELDS[type] || [];
    if (type === CONNECTION_TYPE.GITHUB_ISSUE) {
      return _columns.slice(0, -1);
    }
    return _columns;
  }, [type]);

  const customColumns = useMemo(() => columns.filter(c => {
    if (c.type === CONNECTION_FIELD_TYPE.GROUP) return c.children.find(children => children.is_custom);
    return c.is_custom;
  }), [columns]);

  const initializeConfig = useCallback((newType) => {
    const fields = CONNECTION_FIELDS[newType] || [];
    const defaultConfig = {};
    fields.forEach(field => {
      if (field.type === CONNECTION_FIELD_TYPE.GROUP) {
        field.children.forEach(children => {
          if (children.default_value !== undefined) {
            defaultConfig[children.key] = children.default_value;
          }
        });
      } else {
        if (field.default_value !== undefined) {
          defaultConfig[field.key] = field.default_value;
        }
      }
    });
    return defaultConfig;
  }, []);

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
  }, [name]);

  const onTypeChange = useCallback((newType) => {
    if (type === newType) return;
    setConfig(initializeConfig(newType));
    setType(newType);
  }, [type, initializeConfig]);

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
    } else if (type === CONNECTION_TYPE.DISCOURSE_FORUM) {
      if (newRecord) {
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
    } else {
      setSubmitting(true);
      onSubmit({ type, name: name.trim(), config }, () => {
        setSubmitting(false);
      });
    }
  }, [name, type, config, onSubmit, onToggle, newRecord, modifyConnection]);

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

  const typeOption = CONNECTION_TYPES.find(i => i.type === type);
  const isGithub = useMemo(() => type === CONNECTION_TYPE.GITHUB_ISSUE, [type]);
  const isDiscourse = useMemo(() => type === CONNECTION_TYPE.DISCOURSE_FORUM, [type]);

  const customSteps = useMemo(() => {
    if (isGithub) {
      return [
        STEPS[0], // TYPE
        STEPS[1], // CONFIG
        STEPS[2] // GITHUB
      ];
    } else if (isDiscourse) {
      return [
        STEPS[0], // TYPE
        STEPS[1], // CONFIG
        STEPS[3] // DISCOURSE
      ];
    } else {
      return STEPS.slice(0, 2);
    }
  }, [isGithub, isDiscourse]);

  const handleSubmitDiscourse = useCallback(() => {
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
  }, [name, type, config, onSubmit, stepIndex]);

  const step = customSteps[stepIndex];

  return (
    <Modal isOpen={true} toggle={onToggle} autoFocus={false} className="sea-qa-project-connection-dialog">
      <ModalHeader toggle={onToggle}>{gettext('New connection')}</ModalHeader>
      <ModalBody className="sea-qa-project-connection-body">
        <StepsNavigation
          className="sea-qa-project-new-connection-steps"
          steps={customSteps}
          currentIndex={stepIndex}
        />
        {step.key === STEP.TYPE && (
          <div className="sea-qa-project-new-connection-types">
            {CONNECTION_TYPES.map(connection => {
              const { type: key, name } = connection;
              const isActive = key === type;
              return (
                <div className={classnames('sea-qa-project-new-connection-type', { 'selected': isActive })} key={key} onClick={() => onTypeChange(key)}>
                  <img src={getConnectionIcon(key)} alt={name} className="sea-qa-project-new-connection-icon" />
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
              const { type, key, children } = c;
              if (type === CONNECTION_FIELD_TYPE.GROUP) {
                return (
                  <Row className="mx-0 sea-qa-project-connection-group-config" key={key}>
                    {children.map((child, index) => (
                      <ConnectionConfigEditor className="mx-0 px-0 width-half" column={child} key={`${key}-${index}`} row={config} readonly={isSubmitting} onChange={onConfigChange} />
                    ))}
                  </Row>
                );
              }
              return ((
                <ConnectionConfigEditor column={c} key={key} row={config} readonly={isSubmitting} onChange={onConfigChange} />
              ));
            })}
          </div>
        )}
        {isGithub && step.key === STEP.GITHUB && (
          <div className="sea-qa-project-new-connection-config">
            <FormGroup>
              <Label>{gettext('Connection URL')}</Label>
              <CopyInput value={`${server}/webhook/github/?connection_id=${newRecord.id}`} />
            </FormGroup>
            <FormGroup>
              <Label>{gettext('Webhook secret (optional)')}</Label>
              <TextInput value={config['webhook_secret']} onChange={(newValue) => onConfigChange('webhook_secret', newValue)} />
            </FormGroup>
          </div>
        )}
        {isDiscourse && step.key === STEP.DISCOURSE && (
          <div className="sea-qa-project-new-connection-config">
            <FormGroup>
              <Label>{gettext('Webhook URL')}</Label>
              <CopyInput value={newRecord ? `${server}/webhook/discourse/?connection_id=${newRecord.id}` : gettext('Loading...')} />
            </FormGroup>
            <FormGroup>
              <Label>{gettext('Webhook secret (optional)')}</Label>
              <TextInput value={config['webhook_secret'] || ''} onChange={(newValue) => onConfigChange('webhook_secret', newValue)} />
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
      {isDiscourse &&
      <ModalFooter>
        {stepIndex === 0 && (<Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>)}
        {stepIndex > 0 && stepIndex <= customSteps.length - 1 && (<Button color="secondary" onClick={() => setStepIndex(stepIndex - 1)}>{gettext('Previous')}</Button>)}
        {stepIndex === 0 && <Button color="primary" onClick={() => setStepIndex(stepIndex + 1)}>{gettext('Next')}</Button>}
        {stepIndex === 1 && <Button color="primary" onClick={handleSubmitDiscourse} disabled={isSubmitting}>{gettext('Next')}</Button>}
        {stepIndex === customSteps.length - 1 && <Button color="primary" onClick={handleSubmit}>{gettext('Submit')}</Button>}
      </ModalFooter>
      }
      {!isGithub && !isDiscourse &&
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
