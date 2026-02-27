import React, { useMemo, useEffect } from 'react';
import { mediaUrl } from '@/constants';
import { Selector } from '../components';

const LLM_MODELS = window.app?.pageOptions?.llmModels || [];
const LLM_MODEL_ICON = {
  'qwen': `${mediaUrl}img/llm-providers/qwen.png`,
  'dashscope': `${mediaUrl}img/llm-providers/qwen.png`,
  'gemini': `${mediaUrl}img/llm-providers/gemini.png`,
  'gpt': `${mediaUrl}img/llm-providers/gpt.png`,
  'unknown': `${mediaUrl}img/llm-providers/unknown.png`,
};

const AIModelSelector = ({ isSimple, selectedModel, updateModel }) => {

  const options = useMemo(() => {
    return LLM_MODELS.map(model => {
      let type = model?.type || model?.model?.split('-')[0] || 'unknown';
      type = type.toLowerCase();
      return {
        name: model.label,
        value: model.model,
        default: model.default,
        label: model.label,
        simple_label: model.label,
        img: LLM_MODEL_ICON[type] || LLM_MODEL_ICON['unknown']
      };
    });
  }, []);

  useEffect(() => {
    if (!selectedModel && LLM_MODELS.length > 0) {
      const defaultModel = LLM_MODELS.find(m => m.default === true);
      const modelToUse = defaultModel ? defaultModel.model : LLM_MODELS[0].model;
      updateModel(modelToUse);
    }
  }, []);

  if (LLM_MODELS.length === 0) return null;
  const option = options.find(m => m.value === selectedModel) || options.find(m => m.default === true) || options[0];

  return (
    <Selector
      value={option.value}
      options={options}
      className="sea-qa-ai-model-selector"
      editorClassName="sea-qa-ai-model-selector-editor"
      icon="arrow-down"
      iconPlacement="right"
      border={false}
      onChange={updateModel}
      isSearchEnabled={false}
      displayBgColor={true}
      placement="top-start"
    >
      <div className="sea-qa-ai-model-logo">
        <img src={option.img} alt="" />
      </div>
      <div className="sea-qa-ai-model-name text-truncate">{isSimple ? option?.simple_label : option?.label}</div>
    </Selector>
  );
};

export default AIModelSelector;
