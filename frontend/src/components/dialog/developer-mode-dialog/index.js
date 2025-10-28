import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ModalBody, ModalFooter, Button } from 'reactstrap';
import Switch from '../../../components/switch';
import { gettext } from '../../../constants';
import toaster from '../../../components/toaster';
import { Utils } from '../../../utils/utils';
import { seaQAAPI } from '../../../api/web-api';
import './index.css';

const DeveloperModeDialog = ({
  value: oldValue,
  workspaceID,
  projectName,
  toggleDialog: toggle,
  submit,
}) => {
  const [value, setValue] = useState(oldValue);
  const [submitting, setSubmitting] = useState(false);

  const onToggle = useCallback(() => {
    toggle();
  }, [toggle]);

  const onSubmit = useCallback(() => {
    setSubmitting(true);
    const updates = { developer_mode: value };
    seaQAAPI
      .updateProject(workspaceID, projectName, updates)
      .then(() => {
        toaster.success(gettext('Updated successfully'));
        submit(value);
        toggle();
      })
      .catch((error) => {
        const errorMsg = Utils.getErrorMsg(error);
        toaster.danger(errorMsg);
        setSubmitting(false);
      });
  }, [workspaceID, projectName, value, submit, toggle]);

  const onValueChange = useCallback(() => {
    setValue((prev) => !prev);
  }, []);

  return (
    <>
      <ModalBody className="developer-mode-dialog">
        <Switch
          checked={value}
          disabled={submitting}
          size="large"
          textPosition="right"
          className="change-developer-mode-status w-100"
          onChange={onValueChange}
          placeholder={gettext('Developer mode')}
        />
        <p className="tip m-0">
          {gettext('Enable developer mode to show advanced features for development and debugging purposes.')}
        </p>
      </ModalBody>

      <ModalFooter>
        <Button color="secondary" onClick={onToggle}>
          {gettext('Cancel')}
        </Button>
        <Button
          color="primary"
          disabled={oldValue === value || submitting}
          onClick={onSubmit}
        >
          {submitting ? gettext('Saving...') : gettext('Submit')}
        </Button>
      </ModalFooter>
    </>
  );
};

DeveloperModeDialog.propTypes = {
  value: PropTypes.bool.isRequired,
  workspaceID: PropTypes.string.isRequired,
  projectName: PropTypes.string.isRequired,
  toggleDialog: PropTypes.func.isRequired,
  submit: PropTypes.func.isRequired,
};

export default DeveloperModeDialog;
