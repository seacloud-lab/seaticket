import React, { useMemo } from 'react';
import classnames from 'classnames';
import PriorityFormatter from '@/sea-metadata/components/cell-formatter/priority';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { gettext } from '@/constants';
import {
  PORTAL_ISSUE_STATE_CONFIG,
  PREDEFINED_PORTAL_ISSUE_COLUMN_NAME,
} from '@/project/main-panel/portal-issues/constants';

const getSelectDisplayValue = (column, value) => {
  if (!value) return '';
  const options = column?.data?.options || [];
  const option = options.find(item => item.id === value || item.name === value);
  return option?.name || value;
};

const MobileIssueCards = ({ metadata, onRowClick }) => {
  const columns = useMemo(() => ({
    title: getColumnByName(metadata.columns, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TITLE),
    priority: getColumnByName(metadata.columns, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.PRIORITY),
    state: getColumnByName(metadata.columns, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.STATE),
    type: getColumnByName(metadata.columns, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TYPE),
  }), [metadata.columns]);

  const issues = useMemo(() => {
    const rowIds = metadata.view?.rows || [];
    return rowIds.map(rowId => metadata.id_row_map?.[rowId]).filter(Boolean);
  }, [metadata]);

  if (issues.length === 0) {
    return <div className="seaqa-portal-issue-cards-empty">{gettext('No issues')}</div>;
  }

  return (
    <div className="seaqa-portal-issue-cards">
      {issues.map(issue => {
        const title = getCellValueByColumn(issue, columns.title) || '';
        const priority = Number(getCellValueByColumn(issue, columns.priority) || 0);
        const state = getSelectDisplayValue(columns.state, getCellValueByColumn(issue, columns.state));
        const type = getSelectDisplayValue(columns.type, getCellValueByColumn(issue, columns.type));
        const normalizedState = state.toLowerCase();
        const stateOption = PORTAL_ISSUE_STATE_CONFIG[normalizedState];

        return (
          <button
            type="button"
            className="seaqa-portal-issue-card"
            key={issue._id}
            onClick={() => onRowClick(issue._id)}
          >
            <div className="seaqa-portal-issue-card-title">{title}</div>
            <div className="seaqa-portal-issue-card-meta">
              <div className="seaqa-portal-issue-card-meta-item">
                <span className="seaqa-portal-issue-card-meta-label">{gettext('Priority')}</span>
                <PriorityFormatter value={priority} showName={true}>
                  <span>-</span>
                </PriorityFormatter>
              </div>
              <div className="seaqa-portal-issue-card-meta-item">
                <span className="seaqa-portal-issue-card-meta-label">{gettext('State')}</span>
                <span className={classnames('seaqa-portal-issue-card-state', normalizedState)}>
                  {stateOption?.statusName || state || '-'}
                </span>
              </div>
              <div className="seaqa-portal-issue-card-meta-item">
                <span className="seaqa-portal-issue-card-meta-label">{gettext('Type')}</span>
                <span className="seaqa-portal-issue-card-meta-value">{type || '-'}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default MobileIssueCards;
