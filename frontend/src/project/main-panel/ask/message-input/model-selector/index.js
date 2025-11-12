import React, { useCallback, useRef, useState } from 'react';
import { Icon, IconButton, CustomizePopover } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const ModelSelector = ({ selectedModel, updateModel }) => {
  const [isShowMenu, setIsShowMenu] = useState(false);

  const ref = useRef(null);

  const AVAILABLE_MODELS = window.app?.pageOptions?.availableLLMModels || [];


  const updateModelChange = useCallback((newModel) => {
    if (selectedModel !== newModel) {
      updateModel(newModel);
    }
    setIsShowMenu(false);
  }, [selectedModel, updateModel]);

  const onMenuToggle = useCallback(() => {
    setIsShowMenu(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsShowMenu(false);
  }, []);

  if (AVAILABLE_MODELS.length === 0) {
    return (
      <div className="sea-qa-select custom-select sea-qa-customize-select sea-qa-ai-chat-tool-select sea-qa-ai-model-selector">
        <div className="selected-option">
          <div className="selected-option-show">{gettext('Default')}</div>
        </div>
      </div>
    );
  }

  const currentModel = AVAILABLE_MODELS.find(m => m.value === selectedModel);

  return (
    <>
      <div
        className="sea-qa-select custom-select sea-qa-customize-select sea-qa-ai-chat-tool-select sea-qa-ai-model-selector"
        ref={ref}
        onClick={onMenuToggle}
      >
        <div className="selected-option">
          <div className="selected-option-show">{currentModel?.label || gettext('Default')}</div>
          <Icon symbol="down" />
        </div>
      </div>
      {isShowMenu && (
        <CustomizePopover
          target={ref}
          className="sea-qa-ai-chat-tool-select-editor sea-qa-ai-model-selector-editor"
          hidePopover={handleClose}
          hidePopoverWithEsc={handleClose}
        >
          <div className="sea-qa-ai-model-selector-options">
            {AVAILABLE_MODELS.map((model) => {
              const isSelected = selectedModel === model.value;
              return (
                <div
                  key={model.value}
                  className="sea-qa-ai-model-selector-option"
                  onClick={() => updateModelChange(model.value)}
                >
                  <span>{model.label}</span>
                  <IconButton icon={isSelected ? 'check' : ''} className="no-hover-bg" />
                </div>
              );
            })}
          </div>
        </CustomizePopover>
      )}
    </>
  );
};

export default ModelSelector;
