import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Modal, ModalBody, ModalFooter, Form, FormGroup,
  Label, Input, Button, Alert,
} from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import isHotkey from 'is-hotkey';
import { gettext } from '../../../../utils/constants';
import { validateName } from '../../../../utils/utils';
import { DTableModalHeader } from 'dtable-ui-component';

function AddFolderDialog({ folderType, onAddFolder, onToggleAddFolderDialog }) {
  const [folderName, setFolderName] = useState('');
  const [errMessage, setErrMessage] = useState('');

  function onKeyDown(e) {
    if (isHotkey('enter', e)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleSubmit() {
    const newFolderName = folderName.trim();
    let { isValid, message } = validateName(newFolderName);
    if (!isValid) {
      toaster.danger(message);
      return;
    }
    if (!newFolderName) {
      setErrMessage(gettext('Name is required'));
      return;
    }
    onAddFolder(newFolderName);
    toggle();
  }

  function handleChange(e) {
    const value = e.target.value;
    setFolderName(value);
  }

  function toggle() {
    onToggleAddFolderDialog(folderType);
  }

  return (
    <Modal isOpen={true} toggle={toggle} autoFocus={false} className="add-folder-dialog">
      <DTableModalHeader toggle={toggle}>{gettext('New folder')}</DTableModalHeader>
      <ModalBody>
        <Form>
          <FormGroup>
            <Label for="folderName">{gettext('Name')}</Label>
            <Input
              id="folderName"
              value={folderName}
              onChange={handleChange}
              onKeyDown={onKeyDown}
              autoFocus={true}
            />
          </FormGroup>
        </Form>
        {errMessage && (
          <Alert color="danger" className="mt-2">{gettext(errMessage)}</Alert>
        )}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={toggle}>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={handleSubmit}>{gettext('Submit')}</Button>
      </ModalFooter>
    </Modal>
  );
}

AddFolderDialog.propTypes = {
  folderType: PropTypes.string,
  onAddFolder: PropTypes.func.isRequired,
  onToggleAddFolderDialog: PropTypes.func.isRequired,
};

export default AddFolderDialog;
