import React from 'react';
import SuggestionPreview from '@/project/main-panel/agent/components/run-log-details/run-details/action/suggestion-action/suggestion-preview';
import { getEmailReplyDefaultTo, getSuggestionTitle } from '@/project/main-panel/agent/utils';

import './index.css';

const SuggestionMessage = ({ suggestions }) => {
  if (!Array.isArray(suggestions) || suggestions.length === 0) return null;
  return suggestions.map((suggestion, index) => {
    const title = getSuggestionTitle(suggestion);
    const defaultReplyTo = getEmailReplyDefaultTo(suggestion);
    return (
      <div className="seaqa-ai-suggestion-message seaqa-agent-action-suggestion-card" key={`seaqa-ai-suggestion_${suggestion.tool_name}_${index}`}>
        {title && (
          <div className="text-truncate seaqa-agent-action-suggestion-card-header" title={title}>{title}</div>
        )}
        {!!suggestion?.suggestion_content && (
          <SuggestionPreview
            type={suggestion.tool_name}
            sourceType={suggestion.target_item_type}
            value={suggestion.suggestion_content}
            defaultReplyTo={defaultReplyTo}
          />
        )}
      </div>
    );
  });
};

export default SuggestionMessage;
