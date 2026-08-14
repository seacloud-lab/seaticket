import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { Button } from 'reactstrap';
import { gettext } from '@/constants';
import { IconButton, ResizeBar } from '@/components';
import Detail from './detail';
import { getSuggestionTitle } from '../../../utils';
import { isFunction } from '@/utils/type-detection';
import { isValidEmail } from '@/utils/validate';
import { parseEmailSuggestionContent } from '@/project/main-panel/agent/utils';

import './index.css';

const MIN_WIDTH = 320;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 400;

const SuggestionDetailPanel = ({
  suggestionDetail,
  onSave,
  onApprove,
  onClose,
}) => {
  const [value, setValue] = useState(suggestionDetail?.action?.suggestion_content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const title = useMemo(
    () => getSuggestionTitle(suggestionDetail?.action) || suggestionDetail?.action?.result || '',
    [suggestionDetail?.action]
  );
  const isEdit = useMemo(() => suggestionDetail?.mode === 'edit', [suggestionDetail?.mode]);
  const initValue = useMemo(
    () => suggestionDetail?.action?.suggestion_content || '',
    [suggestionDetail?.action?.suggestion_content]
  );
  const sourceType = useMemo(
    () => suggestionDetail?.action?.target_item_type,
    [suggestionDetail?.action]
  );
  const sourceId = useMemo(
    () => suggestionDetail?.action?.target_item_id,
    [suggestionDetail?.action]
  );
  const isEmailReply = useMemo(
    () => suggestionDetail?.action?.tool_name === 'suggest_reply' && sourceType === 'email',
    [suggestionDetail?.action?.tool_name, sourceType]
  );
  const isEmailContentValid = useMemo(() => {
    const parsed = parseEmailSuggestionContent(value);
    if (!parsed.content || !parsed.content.trim()) return false;
    if (!Array.isArray(parsed.to) || parsed.to.length === 0) return false;
    return [...parsed.to, ...parsed.cc].every(email => isValidEmail(email));
  }, [value]);
  const canSave = useMemo(() => {
    if (isSaving) return false;
    if (initValue === value) return false;
    if (isEmailReply) return isEmailContentValid;
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
    return true;
  }, [isSaving, initValue, value, suggestionDetail, isEmailReply, isEmailContentValid]);
  const canApprove = useMemo(() => {
    if (!isEmailReply || isApproving) return false;
    return isEmailContentValid;
  }, [isEmailReply, isApproving, isEmailContentValid]);
  const suggestionKey = useMemo(() => {
    const { action, runId } = suggestionDetail;
    return `${runId}_${action.id}`;
  }, [suggestionDetail]);

  const ref = useRef(null);

  const handleSave = useCallback(() => {
    const { action, runId } = suggestionDetail;
    if (!isFunction(onSave)) return;
    setIsSaving(true);
    onSave(runId, action.id, value).then((key) => {
      if (key !== suggestionKey) return;
      setIsSaving(false);
    }).catch(key => {
      if (key !== suggestionKey) return;
      setIsSaving(false);
    });
  }, [suggestionDetail, value, suggestionKey, onSave]);

  const handleApprove = useCallback(() => {
    const { action, runId } = suggestionDetail;
    if (!isFunction(onApprove)) return;
    setIsApproving(true);
    const contentToSave = initValue === value ? undefined : value;
    onApprove(runId, action.id, contentToSave).then((success) => {
      setIsApproving(false);
      if (success) onClose && onClose();
    }).catch(() => {
      setIsApproving(false);
    });
  }, [suggestionDetail, initValue, value, onApprove, onClose]);

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
    setIsApproving(false);
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
          sourceType={sourceType}
          sourceId={sourceId}
          isEdit={isEdit}
          isSaving={isSaving || isApproving}
          value={initValue}
          onChange={setValue}
        />
      </div>
      {isEdit && (
        <div className="seaqa-agent-tool-suggestion-panel-footer">
          <Button color="secondary" onClick={onClose}>{gettext('Cancel')}</Button>
          {isEmailReply ? (
            <Button color="primary" onClick={handleApprove} disabled={!canApprove}>
              {isApproving ? gettext('Approving...') : gettext('Approve')}
            </Button>
          ) : (
            <Button color="primary" onClick={handleSave} disabled={!canSave}>
              {isSaving ? gettext('Saving...') : gettext('Save')}
            </Button>
          )}
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
