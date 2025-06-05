import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Modal, ModalBody, ModalFooter, Form, FormGroup,
  Label, Input, Button, Alert,
} from 'reactstrap';
import isHotkey from 'is-hotkey';
import { gettext } from '../../../utils/constants';
import { DTableModalHeader } from 'dtable-ui-component';

function RenameFolderDialog({ folder, closeDialog, onRenameFolder }) {
  const [folderName, setFolderName] = useState(folder.name);
  const [errMessage, setErrMessage] = useState('');

  function onKeyDown(e) {
    if (isHotkey('enter', e)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleSubmit() {
    const newFolderName = folderName.trim();
    if (!newFolderName) {
      setErrMessage(gettext('Name is required'));
      return;
    }
    onRenameFolder(folder, newFolderName);
    closeDialog();
  }

  function handleChange(e) {
    const value = e.target.value;
    setFolderName(value);
  }

  return (
    <Modal isOpen={true} toggle={closeDialog} autoFocus={false} className="add-folder-dialog">
      <DTableModalHeader toggle={closeDialog}>{gettext('Rename')}</DTableModalHeader>
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
        <Button color="secondary" onClick={closeDialog}>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={handleSubmit}>{gettext('Submit')}</Button>
      </ModalFooter>
    </Modal>
  );
}

RenameFolderDialog.propTypes = {
  folder: PropTypes.object,
  closeDialog: PropTypes.func.isRequired,
  onRenameFolder: PropTypes.func.isRequired,
};

export default RenameFolderDialog;
