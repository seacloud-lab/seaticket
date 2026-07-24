import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { Button } from 'reactstrap';
import { gettext } from '@/constants';
import { IconButton } from '@/components';
import Detail from './detail';

import './index.css';

const MIN_WIDTH = 320;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 400;

const SuggestionDetailPanel = ({
  suggestionDetail,
  isSaving,
  onSave,
  onClose,
  width = DEFAULT_WIDTH,
  onWidthChange,
}) => {
  const [value, setValue] = useState(suggestionDetail?.action.suggestion_content || '');

  const title = useMemo(
    () => suggestionDetail?.action?.suggestion_text || suggestionDetail?.action?.result || '',
    [suggestionDetail?.action]
  );
  const isEdit = useMemo(() => suggestionDetail?.mode === 'edit', [suggestionDetail?.mode]);
  const initValue = useMemo(
    () => suggestionDetail?.action.suggestion_content || '',
    [suggestionDetail?.action?.suggestion_content]
  );
  const canSave = useMemo(() => {
    if (isSaving) return false;
    if (initValue === value) return false;
    if (suggestionDetail?.action?.tool_name === '') {
      const validValue = JSON.parse(value);
      if (!validValue.title) return false;
      const validTitle = validValue.title.trim();
      return !!validTitle;
    }
    return true;
  }, [isSaving, initValue, value, suggestionDetail]);

  const resizingRef = useRef(false);

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
    onSave && onSave(value);
  }, [value, onSave]);

  useEffect(() => {
    setValue(suggestionDetail?.action.suggestion_content || '');
  }, [suggestionDetail?.action?.suggestion_content]);

  return (
    <div className="suggestion-detail-panel" style={{ width }}>
      <div className="suggestion-detail-panel-resize" onMouseDown={handleResizeStart} />
      <div className="suggestion-detail-panel-header">
        <span className="suggestion-detail-panel-title text-truncate" title={title}>{title}</span>
        <IconButton icon="close" className="suggestion-detail-panel-close" onClick={onClose}/>
      </div>
      <div className="suggestion-detail-panel-body">
        <Detail
          type={suggestionDetail?.action?.tool_name}
          isEdit={isEdit}
          isSaving={isSaving}
          value={value}
          onChange={setValue}
        />
      </div>
      {isEdit && (
        <div className="suggestion-detail-panel-footer">
          <Button color="secondary" onClick={onClose}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={handleSave} disabled={!canSave}>
            {isSaving ? gettext('Saving...') : gettext('Save')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default SuggestionDetailPanel;
