import React, { useCallback, useEffect, useRef } from 'react';
import { IconButton, ResizeBar } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const INIT_WIDTH = 440;

const SidePanelKnowledgeGap = ({ row, onToggle }) => {
  const ref = useRef(null);

  const onResize = useCallback((width) => {
    const newWidth = window.innerWidth - width;
    localStorage.setItem('project_side_panel_knowledge_gap_width', newWidth);
    ref.current.style.width = `${newWidth}px`;
  }, []);

  useEffect(() => {
    const width = parseFloat(localStorage.getItem('project_side_panel_knowledge_gap_width') || INIT_WIDTH);
    if (ref.current) {
      ref.current.style.width = `${width}px`;
    }
  }, []);

  if (!row) return null;

  return (
    <div className="seaqa-ai-side-panel-chat seaqa-knowledge-gap-panel d-flex flex-column" ref={ref}>
      <div className="seaqa-ai-ask-chats-header">
        <div className="chat-header-title-content text-truncate">{row.normalized_question}</div>
        <IconButton icon="close" onClick={onToggle} />
      </div>
      <div className="seaqa-knowledge-gap-body">
        <div className="seaqa-knowledge-gap-section">
          <div className="seaqa-knowledge-gap-section-title">{gettext('Reason')}</div>
          <div className="seaqa-knowledge-gap-section-text">{row.gap_reason}</div>
        </div>
        <div className="seaqa-knowledge-gap-section">
          <div className="seaqa-knowledge-gap-section-title">{gettext('Suggested knowledge')}</div>
          <div className="seaqa-knowledge-gap-section-text">{row.gap_suggestion}</div>
        </div>
        <div className="seaqa-knowledge-gap-section">
          <div className="seaqa-knowledge-gap-section-title">{gettext('Conversation')}</div>
          <div className="seaqa-knowledge-gap-message">
            <div className="seaqa-knowledge-gap-message-role">{gettext('User')}</div>
            <div className="seaqa-knowledge-gap-message-text">{row.question}</div>
          </div>
          <div className="seaqa-knowledge-gap-message">
            <div className="seaqa-knowledge-gap-message-role">{gettext('Assistant')}</div>
            <div className="seaqa-knowledge-gap-message-text">{row.answer}</div>
          </div>
        </div>
      </div>
      <ResizeBar min={window.innerWidth - 640} max={window.innerWidth - 360} onResize={onResize} />
    </div>
  );
};

export default SidePanelKnowledgeGap;
