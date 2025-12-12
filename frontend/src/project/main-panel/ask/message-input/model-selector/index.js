import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Icon, OptionEditor } from '@/components';

const LLM_MODELS = window.app?.pageOptions?.llmModels || [];

const ModelSelector = ({ selectedModel, updateModel }) => {
  const [isShowMenu, setIsShowMenu] = useState(false);

  const ref = useRef(null);

  const options = useMemo(() => {
    return LLM_MODELS.map(model => ({
      label: model.label,
      name: model.label,
      value: model.model,
      default: model.default,
    }));
  }, []);

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

  if (LLM_MODELS.length === 0) return null;
  const value = options.find(m => m.value === selectedModel) || options.find(m => m.default === true) || options[0];

  return (
    <>
      <div
        className="sea-qa-select custom-select sea-qa-customize-select sea-qa-ai-chat-tool-select sea-qa-ai-model-selector o-hidden"
        ref={ref}
        onClick={onMenuToggle}
      >
        <div className="selected-option">
          <div className="selected-option-show">{value?.label}</div>
          <Icon symbol="down" />
        </div>
      </div>
      {isShowMenu && (
        <OptionEditor
          className="sea-qa-ai-chat-tool-type-select-editor sea-qa-ai-chat-ai-model-type-select-editor "
          options={options}
          target={ref}
          checkPlacement="left"
          isSearchEnabled={false}
          value={selectedModel}
          onChange={updateModelChange}
          onToggle={() => setIsShowMenu(false)}
        />
      )}
    </>
  );
};

export default ModelSelector;
