import React, { useCallback } from 'react';
import classnames from 'classnames';

const ClearContext = ({ clearContext, updateClearContext }) => {
  const toggleUpdateClearContext = useCallback(() => {
    updateClearContext(!clearContext);
  }, [clearContext, updateClearContext]);

  return (
    <div
      className={classnames(
        'sea-qa-select custom-select sea-qa-customize-select sea-qa-ai-chat-tool-select',
        { highlighted: clearContext }
      )}
      onClick={toggleUpdateClearContext}
    >
      <div className="selected-option">
        <div className="selected-option-show">{'clear_context_icon'}</div>
      </div>
    </div>
  );
};

export default ClearContext;
