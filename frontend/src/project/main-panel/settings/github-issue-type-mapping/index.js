import React, { useCallback, useEffect, useMemo, useState } from 'react';
import classnames from 'classnames';
import { CustomizeSelect, Icon, Option } from '@/components';
import SecondaryBtn from '@/components/btn/secondary-btn';
import toaster from '@/components/toaster';
import { agentAPI } from '@/project/api';
import { gettext } from '@/constants';
import { getConnectionIcon } from '../../connections/utils';
import { CONNECTION_TYPE } from '../../connections/constants';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const AGENT_TYPE_ROWS = ['Bug', 'Feature', 'Question'];

const GitHubIssueTypeMappingSettings = ({ className, value, onChange }) => {
  const [githubIssueTypes, setGithubIssueTypes] = useState([]);
  const [warningCode, setWarningCode] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [syncState, setSyncState] = useState('loading'); // loading, start_sync, syncing, sync_end

  const isSyncing = useMemo(() => syncState === 'loading' || syncState === 'syncing', [syncState]);
  const syncInfo = useMemo(() => {
    if (syncState === 'loading') return { icon: 'loading', text: gettext('Loading...') };
    if (syncState === 'start_sync') return { icon: 'sync', text: gettext('Sync GitHub issue type') };
    if (syncState === 'syncing') return { icon: 'loading', text: gettext('Syncing...') };
    return { icon: 'check-circle-stroked', text: gettext('Sync completed') };
  }, [syncState]);

  const options = useMemo(() => {
    if (!Array.isArray(githubIssueTypes) || githubIssueTypes.length === 0) return [];
    return githubIssueTypes
      .filter(item => item?.name)
      .map(item => ({
        value: item.name,
        label: <Option option={item} />,
      }));
  }, [githubIssueTypes]);

  const warningText = useMemo(() => {
    if (!warningCode && !errorCode) return '';
    if (warningCode === 'no_github_connection') {
      return gettext('Please connect a GitHub repository first.');
    }
    if (warningCode === 'invalid_github_connection') {
      return gettext('Current GitHub connection is invalid.');
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
    if (!selectedGithubType) return;
    const newValue = { ...value, [agentType]: selectedGithubType };
    onChange && onChange(newValue);
  }, [value, onChange]);

  const handleSync = useCallback(() => {
    if (isSyncing) return;
    setSyncState('syncing');
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
    }).finally(() => {
      setSyncState('sync_end');
    });
  }, [isSyncing]);

  useEffect(() => {
    agentAPI.getGithubIssueTypes(projectUuid).then((res) => {
      setGithubIssueTypes(res.data?.issue_types || []);
      setWarningCode(res.data?.warning || '');
      setErrorCode('');
    }).catch((err) => {
      setGithubIssueTypes([]);
      setWarningCode('');
      setErrorCode(err?.response?.data?.error_code || 'request_failed');
    }).finally(() => {
      setSyncState('start_sync');
    });
  }, []);

  return (
    <div className={classnames('github-issue-type-mapping-settings w-100 pl-4 pr-4 pt-2', className)}>
      <div className="github-issue-type-mapping-header text-truncate mb-4">
        {gettext('Agent issue type to GitHub issue type')}
      </div>
      <div className="github-issue-type-mapping-body github-issue-type-mapping-table">
        <div className="github-issue-type-mapping-table-header github-issue-type-mapping-table-row">
          <div className="github-issue-type-mapping-table-cell">
            <div className="github-issue-type-mapping-title">
              <Icon symbol="ai-processing" className="github-issue-type-mapping-title-icon" />
              <span>{gettext('Agent issue type')}</span>
            </div>
          </div>
          <div className="github-issue-type-mapping-table-cell">
            <div className="github-issue-type-mapping-title">
              <img src={getConnectionIcon(CONNECTION_TYPE.GITHUB_ISSUE)} alt="GitHub issue" className="github-issue-type-mapping-title-icon" />
              <span>{gettext('GitHub issue type')}</span>
            </div>
            <SecondaryBtn
              className="github-issue-type-mapping-sync-btn"
              icon={syncInfo.icon}
              text={syncInfo.text}
              onClick={handleSync}
              doing={isSyncing}
              gap={4}
              isSmall
            />
          </div>
        </div>
        <div className="github-issue-type-mapping-table-body">
          {AGENT_TYPE_ROWS.map((agentType) => {
            const currentValue = (value[agentType] || '').trim();
            const selectedOption = options.find((option) => option.value === currentValue) || null;
            return (
              <div key={agentType} className="github-issue-type-mapping-table-row">
                <div className="github-issue-type-mapping-table-cell">
                  <Option option={{ name: agentType, color: '#fff' }} className="github-issue-type-agent-type" />
                </div>
                <div className="github-issue-type-mapping-table-cell">
                  <CustomizeSelect
                    className="github-issue-type-selector"
                    value={selectedOption}
                    options={options}
                    placeholder={gettext('Please select')}
                    onChange={(selected) => handleChange(agentType, selected)}
                    disabled={options.length === 0}
                    isInModal={true}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {warningText && (
          <p className="seaqa-tip-default tip m-0 mt-2">
            {warningText}
          </p>
        )}
      </div>
    </div>
  );
};

export default GitHubIssueTypeMappingSettings;
