import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Button } from 'reactstrap';
import { gettext } from '@/constants';
import { IconButton } from '@/components';

import './suggestion-detail-panel.css';

const MIN_WIDTH = 320;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 400;

const SuggestionDetailPanel = ({
  title,
  content,
  mode,
  isSaving,
  onSave,
  onClose,
  width = DEFAULT_WIDTH,
  onWidthChange,
}) => {
  const isEdit = mode === 'edit';
  const [editValue, setEditValue] = useState(content || '');
  const resizingRef = useRef(false);

  useEffect(() => {
    setEditValue(content || '');
  }, [content, mode]);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    resizingRef.current = true;

    const handleMouseMove = (ev) => {
      if (!resizingRef.current) return;
      const nextWidth = window.innerWidth - ev.clientX;
      const nextPanelWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, nextWidth));
      onWidthChange && onWidthChange(nextPanelWidth);
    };
    const handleMouseUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };

    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onWidthChange]);

  const handleSave = useCallback(() => {
    onSave && onSave(editValue);
  }, [editValue, onSave]);

  return (
    <div className="suggestion-detail-panel" style={{ width }}>
      <div className="suggestion-detail-panel-resize" onMouseDown={handleResizeStart} />
      <div className="suggestion-detail-panel-header">
        <span className="suggestion-detail-panel-title text-truncate" title={title}>{title}</span>
        <IconButton
          icon="close"
          className="suggestion-detail-panel-close"
          onClick={onClose}
        />
      </div>
      <div className="suggestion-detail-panel-body">
        {isEdit ? (
          <textarea
            className="suggestion-detail-panel-textarea"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            placeholder={gettext('Edit content...')}
            spellCheck={false}
            autoFocus
          />
        ) : (
          <div className="suggestion-detail-panel-content">{content}</div>
        )}
      </div>
      {isEdit && (
        <div className="suggestion-detail-panel-footer">
          <Button color="secondary" onClick={onClose}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={handleSave} disabled={isSaving || editValue === content}>
            {isSaving ? gettext('Saving...') : gettext('Save')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default SuggestionDetailPanel;
