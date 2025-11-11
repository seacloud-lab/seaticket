import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, Input, ModalBody, ModalFooter, FormGroup, Label, Alert, Row } from 'reactstrap';
import { gettext } from '@/constants';
import { validateName } from '@/utils/validate';
import { CONNECTION_FIELDS, CONNECTION_FIELD_TYPE, CONNECTION_TYPE } from '../../constants';
import { ModalHeader } from '@/components';
import ConnectionConfigEditor from '../connection-config-editor';

import '../new-connection-dialog/index.css';

const ModifyConnectionDialog = ({ record, onSubmit, onToggle }) => {
  const [name, setName] = useState(record?.name || '');
  const [config, setConfig] = useState(record?.config || {});
  const [isChanged, setChanged] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const type = useMemo(() => record.type, [record]);
  const columns = useMemo(() => {
    const _columns = CONNECTION_FIELDS[type] || [];
    if (type === CONNECTION_TYPE.EMAIL) {
      return _columns.slice(0, -1);
    }
    return _columns;
  }, [type]);
  const customColumns = useMemo(() => columns.filter(c => {
    if (c.type === CONNECTION_FIELD_TYPE.GROUP) return c.children.find(children => children.is_custom);
    return c.is_custom;
  }), [columns]);

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
    <Modal isOpen={true} toggle={onToggle} autoFocus={false} className="sea-qa-project-connection-dialog" >
      <ModalHeader toggle={onToggle}>{gettext('Edit connection')}</ModalHeader>
      <ModalBody className="sea-qa-project-connection-body">
        <FormGroup>
          <Label>
            {gettext('Connection name')}
            <span className="required-tip" title={gettext('Required')}>{'*'}</span>
          </Label>
          <Input value={name} onChange={onNameChange} autoFocus disabled={isSubmitting} />
        </FormGroup>
        {customColumns.map(c => {
          const { type, key, children } = c;
          if (type === CONNECTION_FIELD_TYPE.GROUP) {
            return (
              <Row className="mx-0 sea-qa-project-connection-group-config" key={key}>
                {children.map((child, index) => (
                  <ConnectionConfigEditor
                    key={`${key}-${index}`}
                    column={child}
                    className="mx-0 px-0 width-half"
                    row={config}
                    readonly={isSubmitting}
                    canModifyPassword={false}
                    onChange={onConfigChange}
                  />
                ))}
              </Row>
            );
          }
          return ((
            <ConnectionConfigEditor
              column={c}
              key={key}
              row={config}
              readonly={isSubmitting}
              canModifyPassword={false}
              onChange={onConfigChange}
            />
          ));
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
