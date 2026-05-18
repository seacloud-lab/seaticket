import React, { useCallback, useState } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import EditPromptDialog from './edit-prompt-dialog';

import './index.css';

const PromptSettings = ({
  value: oldValue = '',
  onChange,
  className,
}) => {
  const [value, setValue] = useState(oldValue);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

  // Truncate prompt for preview display
  const getPromptPreview = (prompt, maxLength = 100) => {
    if (!prompt) return gettext('Not set');
    const promptStr = String(prompt);
    if (promptStr.length <= maxLength) return promptStr;
    return promptStr.substring(0, maxLength) + '...';
  };

  return (
    <>
      <div className={classnames('prompt-settings-option w-100 pl-4 pr-4', className)}>
        <div className="prompt-settings-option-header text-truncate">{gettext('Project prompt')}</div>
        <div className="prompt-settings-option-body">
          <p className="seaqa-tip-default tip m-0 mb-2">
            {gettext('Set the AI system prompt for this project. This prompt will be applied to all AI conversations within this project.')}
          </p>
          <div className="prompt-preview-container">
            <div className="prompt-preview">
              {getPromptPreview(value)}
            </div>
            <button
              className="btn btn-outline-primary btn-sm edit-prompt-btn"
              onClick={openDialog}
            >
              {gettext('Edit')}
            </button>
          </div>
        </div>
      </div>
      {isDialogOpen && (
        <EditPromptDialog
          value={value}
          onConfirm={onConfirm}
          onToggle={closeDialog}
        />
      )}
    </>
  );
};

export default PromptSettings;
