import React, { useCallback, useEffect, useMemo, useState } from 'react';
import classnames from 'classnames';
import { CustomizeSelect, Option } from '@/components';
import SecondaryBtn from '@/components/btn/secondary-btn';
import toaster from '@/components/toaster';
import { agentAPI } from '@/project/api';
import { gettext } from '@/constants';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const AGENT_TYPE_ROWS = ['Bug', 'Feature', 'Question'];
// Keep in sync with AUTO_MATCH_AGENT_ISSUE_TYPES on the backend.
const AUTO_MATCH_AGENT_TYPES = new Set(['Bug', 'Feature']);

const GithubIssueTypeMappingSettings = ({ className, agentSettings, onChange }) => {
  const [githubIssueTypes, setGithubIssueTypes] = useState([]);
  const [warningCode, setWarningCode] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    agentAPI.getGithubIssueTypes(projectUuid).then((res) => {
      setGithubIssueTypes(res.data?.issue_types || []);
      setWarningCode(res.data?.warning || '');
      setErrorCode('');
    }).catch((err) => {
      setGithubIssueTypes([]);
      setWarningCode('');
      setErrorCode(err?.response?.data?.error_code || 'request_failed');
    });
  }, []);

  const handleSync = useCallback(() => {
    if (isSyncing) return;
    setIsSyncing(true);
    agentAPI.syncGithubIssueTypes(projectUuid).then((res) => {
      const data = res.data || {};
      setGithubIssueTypes(data.issue_types || []);
      setWarningCode('');
      setErrorCode('');
      const added = data.added || 0;
      const updated = data.updated || 0;
      const deleted = data.deleted || 0;
      if (added + updated + deleted === 0) {
        toaster.success(gettext('GitHub issue types are up to date.'));
      } else {
        const parts = [];
        if (added) parts.push(gettext('added {n}').replace('{n}', added));
        if (updated) parts.push(gettext('updated {n}').replace('{n}', updated));
        if (deleted) parts.push(gettext('deleted {n}').replace('{n}', deleted));
        toaster.success(
          gettext('GitHub issue types synced: {summary}.').replace(
            '{summary}', parts.join(', ')
          )
        );
      }
    }).catch((err) => {
      const msg = err?.response?.data?.error_msg
        || gettext('Failed to sync GitHub issue types.');
      toaster.danger(msg);
    }).then(() => {
      setIsSyncing(false);
    });
  }, [isSyncing]);

  const options = useMemo(() => {
    return (githubIssueTypes || [])
      .filter((item) => Boolean(item?.name))
      .map((item) => ({
        value: item.name,
        label: <Option option={item} />,
      }));
  }, [githubIssueTypes]);

  // For Bug/Feature, if there is a same-named (case-insensitive) GitHub type,
  // record the original-cased name so we can show an "Auto-matched to ..."
  // hint when no explicit mapping is configured.
  const autoMatched = useMemo(() => {
    const result = {};
    const types = githubIssueTypes || [];
    for (const agentType of AGENT_TYPE_ROWS) {
      if (!AUTO_MATCH_AGENT_TYPES.has(agentType)) continue;
      const target = agentType.toLowerCase();
      const hit = types.find((t) => (t?.name || '').trim().toLowerCase() === target);
      if (hit) result[agentType] = hit.name;
    }
    return result;
  }, [githubIssueTypes]);

  const mapping = (agentSettings?.github_issue_type_mapping) || {};

  const getWarningText = useCallback(() => {
    if (warningCode === 'no_github_connection') {
      return gettext('Please connect a GitHub repository first.');
    }
    if (warningCode === 'invalid_github_connection') {
      return gettext('Current GitHub connection is invalid.');
    }
    if (!errorCode) {
      return '';
    }
    if (errorCode === 'github_permission_denied') {
      return gettext('GitHub App missing "Issue Types" permission.');
    }
    if (errorCode === 'not_an_org') {
      return gettext('GitHub issue types are only available for organizations.');
    }
    return gettext('Failed to load GitHub issue types.');
  }, [warningCode, errorCode]);

  const handleChange = useCallback((agentType, selectedGithubType) => {
    if (!selectedGithubType) {
      return;
    }
    const newMapping = {
      ...mapping,
      [agentType]: selectedGithubType,
    };
    onChange && onChange(newMapping);
  }, [mapping, onChange]);

  const warningText = getWarningText();

  return (
    <div className={classnames('github-issue-type-mapping-settings w-100 pl-4 pr-4', className)}>
      <div className="github-issue-type-mapping-header text-truncate">
        {gettext('Agent issue type to GitHub issue type')}
      </div>
      <div className="github-issue-type-mapping-body">
        {AGENT_TYPE_ROWS.map((agentType) => {
          const currentValue = (mapping[agentType] || '').trim();
          const selectedOption = options.find((option) => option.value === currentValue) || null;
          const autoMatchedName = !currentValue ? autoMatched[agentType] : '';
          return (
            <div key={agentType} className="github-issue-type-mapping-row">
              <div className="github-issue-type-agent-type">{agentType}</div>
              <span className="github-issue-type-mapping-arrow" aria-hidden="true">→</span>
              <CustomizeSelect
                className="github-issue-type-selector"
                value={selectedOption}
                options={options}
                placeholder={gettext('Please select')}
                onChange={(selected) => handleChange(agentType, selected)}
                disabled={options.length === 0}
              />
              {autoMatchedName && (
                <span className="github-issue-type-auto-hint">
                  {gettext('Auto-matched to {name}').replace('{name}', autoMatchedName)}
                </span>
              )}
            </div>
          );
        })}
        <div className="github-issue-type-mapping-actions">
          <SecondaryBtn
            className="github-issue-type-mapping-sync-btn"
            text={gettext('Sync GitHub issue types')}
            onClick={handleSync}
            disabled={isSyncing}
            isSmall
          />
        </div>
        {warningText && (
          <p className="tip-default tip m-0 mt-2">
            {warningText}
          </p>
        )}
      </div>
    </div>
  );
};

export default GithubIssueTypeMappingSettings;
