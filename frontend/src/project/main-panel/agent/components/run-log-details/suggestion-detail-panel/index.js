import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { Button } from 'reactstrap';
import { IconButton, ResizeBar } from '@/components';
import { gettext } from '@/constants';
import { isFunction } from '@/utils/type-detection';
import { getSuggestionTitle } from '../../../utils';
import Detail from './detail';

import './index.css';

const MIN_WIDTH = 320;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 400;

const SuggestionDetailPanel = ({
  suggestionDetail,
  onApprove,
  onClose,
}) => {
  const [value, setValue] = useState(suggestionDetail?.action?.suggestion_content || '');
  const [isSaving, setIsSaving] = useState(false);

  const title = useMemo(
    () => getSuggestionTitle(suggestionDetail?.action) || suggestionDetail?.action?.result || '',
    [suggestionDetail?.action]
  );
  const isEdit = useMemo(() => suggestionDetail?.mode === 'edit', [suggestionDetail?.mode]);
  const initValue = useMemo(
    () => suggestionDetail?.action?.suggestion_content || '',
    [suggestionDetail?.action?.suggestion_content]
  );
  const canApprove = useMemo(() => {
    if (isSaving) return false;
    if (suggestionDetail?.action?.tool_name === 'suggest_create_ticket') {
      try {
        const validValue = JSON.parse(value);
        if (!validValue.title) return false;
        const validTitle = validValue.title.trim();
        return !!validTitle;
      } catch {
        return false;
      }
    }
    return !!value.trim();
  }, [isSaving, value, suggestionDetail?.action?.tool_name]);
  const suggestionKey = useMemo(() => {
    const { action, runId } = suggestionDetail;
    return `${runId}_${action.id}`;
  }, [suggestionDetail]);

  const ref = useRef(null);

  const runPanelAction = useCallback((actionFn) => {
    const { action, runId } = suggestionDetail;
    if (!isFunction(actionFn)) return;
    setIsSaving(true);
    actionFn(runId, action.id, value).then((key) => {
      if (key !== suggestionKey) return;
      setIsSaving(false);
    }).catch(key => {
      if (key !== suggestionKey) return;
      setIsSaving(false);
    });
  }, [suggestionDetail, value, suggestionKey]);

  const handleApprove = useCallback(() => runPanelAction(onApprove), [runPanelAction, onApprove]);

  const onResize = useCallback((width) => {
    localStorage.setItem('project_agent_action_suggestion_panel_width', window.innerWidth - width - 8);
    ref.current.style.width = `${window.innerWidth - width - 8}px`;
  }, []);

  useEffect(() => {
    const width = parseFloat(localStorage.getItem('project_agent_action_suggestion_panel_width') || DEFAULT_WIDTH);
    ref.current.style.width = `${width}px`;
  }, []);

  useEffect(() => {
    setValue(suggestionDetail?.action?.suggestion_content || '');
  }, [suggestionDetail?.action?.suggestion_content]);

  useEffect(() => {
    setIsSaving(false);
  }, [suggestionKey]);

  return (
    <div className="seaqa-agent-tool-suggestion-panel" ref={ref}>
      <div className="seaqa-agent-tool-suggestion-panel-header">
        <span className="seaqa-agent-tool-suggestion-panel-title text-truncate" title={title}>{title}</span>
        <IconButton icon="close" className="flex-shrink-0" onClick={onClose}/>
      </div>
      <div className="seaqa-agent-tool-suggestion-panel-body">
        <Detail
          type={suggestionDetail?.action?.tool_name}
          isEdit={isEdit}
          isSaving={isSaving}
          value={initValue}
          onChange={setValue}
        />
      </div>
      {isEdit && (
        <div className="seaqa-agent-tool-suggestion-panel-footer">
          <Button color="secondary" onClick={onClose}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={handleApprove} disabled={!canApprove}>
            {isSaving ? gettext('Approving...') : gettext('Approve')}
          </Button>
        </div>
      )}
      <ResizeBar
        min={window.innerWidth - MAX_WIDTH - 8}
        max={window.innerWidth - MIN_WIDTH - 8}
        onResize={onResize}
        className="position-absolute h-100"
      />
    </div>
  );
};

export default SuggestionDetailPanel;
