import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ModalBody, ModalFooter, Button } from 'reactstrap';
import { Loading, Switch } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const DeveloperModeSettings = ({
  value: oldValue = false,
  onChange,
  onToggle,
}) => {
  const [value, setValue] = useState(oldValue);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(() => {
    setSubmitting(true);
    onChange && onChange(value, ({ error } = {}) => {
      if (error) {
        setSubmitting(false);
        return;
      }
      onToggle();
    });
  }, [value, onToggle]);

  const onValueChange = useCallback(() => {
    setValue((prev) => !prev);
  }, []);

  return (
    <>
      <ModalBody className="developer-mode-settings">
        <Switch
          checked={value}
          disabled={submitting}
          size="large"
          textPosition="right"
          className="change-developer-mode-status w-100"
          onChange={onValueChange}
          placeholder={gettext('Developer mode')}
        />
        <p className="tip-default tip m-0">
          {gettext('Enable developer mode to show advanced features for development and debugging purposes.')}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onToggle}>
          {gettext('Cancel')}
        </Button>
        <Button
          color="primary"
          className="submit-btn"
          disabled={oldValue === value || submitting}
          onClick={onSubmit}
        >
          {submitting && (
            <>
              <Loading />
              <span className="ml-2">{gettext('Submitting')}</span>
            </>
          )}
          {!submitting && gettext('Submit')}
        </Button>
      </ModalFooter>
    </>
  );
};

DeveloperModeSettings.propTypes = {
  value: PropTypes.bool.isRequired,
  workspaceID: PropTypes.string.isRequired,
  projectName: PropTypes.string.isRequired,
  toggleDialog: PropTypes.func.isRequired,
  submit: PropTypes.func.isRequired,
};

export default DeveloperModeSettings;
