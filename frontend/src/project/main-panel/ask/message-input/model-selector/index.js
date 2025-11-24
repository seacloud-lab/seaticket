import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Icon, IconButton, CustomizePopover } from '@/components';

import './index.css';

const ModelSelector = ({ selectedModel, updateModel }) => {
  const [isShowMenu, setIsShowMenu] = useState(false);

  const ref = useRef(null);

  const CUSTOM_LLM_MODELS = window.app?.pageOptions?.customLLMModels || [];

  useEffect(() => {
    if (!selectedModel && CUSTOM_LLM_MODELS.length > 0) {
      updateModel(CUSTOM_LLM_MODELS[0].model);
    }
  }, []);

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

  if (CUSTOM_LLM_MODELS.length === 0) {
    return null;
  }

  const currentModel = CUSTOM_LLM_MODELS.find(m => m.model === selectedModel);

  return (
    <>
      <div
        className="sea-qa-select custom-select sea-qa-customize-select sea-qa-ai-chat-tool-select sea-qa-ai-model-selector"
        ref={ref}
        onClick={onMenuToggle}
      >
        <div className="selected-option">
          <div className="selected-option-show">{currentModel?.label || CUSTOM_LLM_MODELS[0]?.label}</div>
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
            {CUSTOM_LLM_MODELS.map((model) => {
              const isSelected = selectedModel === model.model;
              return (
                <div
                  key={model.model}
                  className="sea-qa-ai-model-selector-option"
                  onClick={() => updateModelChange(model.model)}
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
