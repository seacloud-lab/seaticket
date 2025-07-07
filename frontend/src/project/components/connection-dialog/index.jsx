import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, Input, ModalBody, ModalFooter, FormGroup, Label, Alert } from 'reactstrap';
import { gettext } from '../../../constants';
import CustomModalHeader from '../../../components/modal-header';
import CustomizeSelect from '../../../components/customize-select';
import { CONNECTION_TYPE, CONNECTION_TYPES } from '../../constants';

import './index.css';

const ConnectionDialog = ({ onSubmit, onToggle, connection, connections }) => {
  const [name, setName] = useState(connection?.name || '');
  const [type, setType] = useState(connection?.type || CONNECTION_TYPE.SITES);
  const [isSubmitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isChanged, setChanged] = useState(Boolean(!connection));

  const typeOptions = useMemo(() => {
    return CONNECTION_TYPES.map(t => ({
      value: t.key,
      name: t.name,
      label: t.name,
    }));
  }, []);
  const selectedType = useMemo(() => {
    return typeOptions.find(t => t.value === type) || typeOptions[0];
  }, [typeOptions, type]);
  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    if (!type) return false;
    const validConnections = connection ? connections.filter(c => c.id !== connection.id) : connections;
    if (validConnections.find(c => c.name === name)) return false;
    return true;
  }, [type, name, connection, connections]);

  const onNameChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === name) return;
    setChanged(true);
    setName(newValue);
  }, [name]);

  const onTypeChange = useCallback((newType) => {
    if (type === newType) return;
    setChanged(true);
    setType(newType);
  }, [type]);

  const handleSubmit = useCallback(() => {
    const validName = name.trim();
    const validType = type.trim();

    setSubmitting(true);
    onSubmit(validType, validName, (errorMessage) => {
      if (errorMessage) {
        setErrorMsg(errorMessage);
        setSubmitting(false);
        return;
      }
      onToggle();
    });
  }, [name, type, onSubmit, onToggle]);

  return (
    <Modal isOpen={true} toggle={onToggle} autoFocus={false} className="project-connection-editor-dialog">
      <CustomModalHeader toggle={onToggle}>{connection ? gettext('Edit connection') : gettext('New connection')}</CustomModalHeader>
      <ModalBody className="project-connection-type-body">
        <FormGroup>
          <Label for="connection-name">{gettext('Name')}</Label>
          <Input value={name} onChange={onNameChange} autoFocus disabled={isSubmitting} placeholder={gettext('Please input name')} id="connection-name" />
        </FormGroup>
        {!connection && (
          <FormGroup>
            <Label for="connection-type">{gettext('Type')}</Label>
            <CustomizeSelect
              searchable={true}
              isInModal={true}
              id="connection-type"
              value={selectedType}
              placeholder={gettext('Select a type')}
              options={typeOptions}
              onChange={onTypeChange}
              searchPlaceholder={gettext('Search types')}
              noOptionsPlaceholder={gettext('No types')}
            />
          </FormGroup>
        )}
        {errorMsg && (<Alert color="danger">{errorMsg}</Alert>)}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={handleSubmit} disabled={isSubmitting || !isValid || !name || !isChanged}>{gettext('Submit')}</Button>
      </ModalFooter>
    </Modal>
  );
};

ConnectionDialog.propTypes = {
  connection: PropTypes.object,
  connections: PropTypes.array,
  onSubmit: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired
};

export default ConnectionDialog;
