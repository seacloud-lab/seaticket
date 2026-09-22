import React, { useCallback, useEffect, useState } from 'react';
import { Button } from 'reactstrap';
import classnames from 'classnames';
import { gettext } from '@/constants';
import SettingsItem from '../settings-item';
import PromptDialog from './prompt-dialog';

import './index.css';

const PromptSettings = ({
  value: oldValue = '',
  onChange,
  className,
  title = gettext('Project prompt'),
  tip = gettext('Set the AI system prompt for this project. This prompt will be applied to all AI conversations within this project.'),
  dialogTitle = gettext('Edit prompt'),
  placeholder = gettext('Provide the project background information for the AI to understand the project accurately. Enter your custom project prompt here...'),
  maxLength = 4000,
  validationMessage = gettext('Project prompt cannot contain tag-like content such as <system-reminder>.'),
}) => {
  const [value, setValue] = useState(oldValue);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    setValue(oldValue || '');
  }, [oldValue]);

  const openDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const onConfirm = useCallback((newValue) => {
    setValue(newValue);
    onChange && onChange(newValue, () => {
      setIsDialogOpen(false);
    });
  }, [onChange]);

  return (
    <>
      <SettingsItem title={title} className={classnames('prompt-settings-option', className)}>
        <p className="seaqa-tip-default m-0 mb-2 font-size-12 line-height-20">
          {tip}
        </p>
        {value && (
          <div className="prompt-preview mb-2">
            <div className="prompt-preview-content px-4 py-3">
              {value}
            </div>
          </div>
        )}
        <Button color="primary" outline onClick={openDialog}>
          {dialogTitle}
        </Button>
      </SettingsItem>
      {isDialogOpen && (
        <PromptDialog
          value={value}
          onConfirm={onConfirm}
          onToggle={closeDialog}
          title={dialogTitle}
          placeholder={placeholder}
          maxLength={maxLength}
          validationMessage={validationMessage}
        />
      )}
    </>
  );
};

export default PromptSettings;
