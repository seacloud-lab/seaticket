import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Icon, IconButton, CustomizePopover } from '@/components';

import './index.css';

const ModelSelector = ({ selectedModel, updateModel }) => {
  const [isShowMenu, setIsShowMenu] = useState(false);

  const ref = useRef(null);

  const LLM_MODELS = window.app?.pageOptions?.llmModels || [];

  useEffect(() => {
    if (!selectedModel && LLM_MODELS.length > 0) {
      const defaultModel = LLM_MODELS.find(m => m.default === true);
      const modelToUse = defaultModel ? defaultModel.model : LLM_MODELS[0].model;
      updateModel(modelToUse);
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

  if (LLM_MODELS.length === 0) {
    return null;
  }

  const currentModel = LLM_MODELS.find(m => m.model === selectedModel);
  const defaultModel = LLM_MODELS.find(m => m.default === true);
  const fallbackModel = defaultModel || LLM_MODELS[0];

  return (
    <>
      <div
        className="sea-qa-select custom-select sea-qa-customize-select sea-qa-ai-chat-tool-select sea-qa-ai-model-selector"
        ref={ref}
        onClick={onMenuToggle}
      >
        <div className="selected-option">
          <div className="selected-option-show">{currentModel?.label || fallbackModel?.label}</div>
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
            {LLM_MODELS.map((model) => {
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
