import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import classnames from 'classnames';
import PriorityFormatter from '@/sea-metadata/components/cell-formatter/priority';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { getColumnByName, getOption } from '@/sea-metadata/utils/column';
import { gettext } from '@/constants';
import { Icon, Loading, Option } from '@/components';
import { useTypesData } from '@/sea-metadata/hooks';
import { getRowById } from '@/sea-metadata/utils/row';
import {
  PORTAL_ISSUE_STATE_CONFIG,
  PREDEFINED_PORTAL_ISSUE_COLUMN_NAME,
} from '@/project/main-panel/portal-issues/constants';

const LOAD_MORE_THRESHOLD = 80;

const getSelectOption = (column, value) => {
  if (!value) return null;
  const options = column?.data?.options || [];
  return getOption(options, value);
};

const getStateOption = (column, value) => {
  if (!value) return {};
  const options = column?.data?.options || [];
  const option = getOption(options, value);
  const stateId = option?.id || value;
  const stateName = (option?.name || value || '').toLowerCase();
  return {
    option: PORTAL_ISSUE_STATE_CONFIG[stateId],
    name: stateName,
  };
};

const MobileIssueCards = ({ metadata, hasMore, isLoadingMore, loadMore, onRowClick }) => {
  const { typesData } = useTypesData();
  const cardsRef = useRef(null);
  const columns = useMemo(() => ({
    title: getColumnByName(metadata.columns, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TITLE),
    priority: getColumnByName(metadata.columns, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.PRIORITY),
    state: getColumnByName(metadata.columns, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.STATE),
    type: getColumnByName(metadata.columns, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TYPE),
  }), [metadata.columns]);

  const rowIds = metadata.view?.rows || [];
  const issues = rowIds.map(rowId => metadata.id_row_map?.[rowId]).filter(Boolean);

  const handleScroll = useCallback((event) => {
    if (!hasMore || isLoadingMore || !loadMore) return;
    const { clientHeight, scrollHeight, scrollTop } = event.currentTarget;
    const isNearBottom = clientHeight + scrollTop + LOAD_MORE_THRESHOLD >= scrollHeight;
    if (isNearBottom) loadMore();
  }, [hasMore, isLoadingMore, loadMore]);

  useEffect(() => {
    const cards = cardsRef.current;
    if (!cards || !hasMore || isLoadingMore || !loadMore) return;
    if (cards.scrollHeight <= cards.clientHeight + LOAD_MORE_THRESHOLD) loadMore();
  }, [hasMore, isLoadingMore, issues.length, loadMore]);

  if (issues.length === 0) {
    return <div className="seaqa-portal-issue-cards-empty">{gettext('No issues')}</div>;
  }

  return (
    <div className="seaqa-portal-issue-cards" ref={cardsRef} onScroll={handleScroll}>
      {issues.map(issue => {
        const title = getCellValueByColumn(issue, columns.title) || '';
        const priority = Number(getCellValueByColumn(issue, columns.priority) || 0);
        const state = getCellValueByColumn(issue, columns.state);
        const { option: stateOption, name: normalizedState } = getStateOption(columns.state, state);
        const typeValue = getCellValueByColumn(issue, columns.type);
        const typeOption = getRowById(typesData, typeValue) || getSelectOption(columns.type, typeValue);

        return (
          <div
            className="seaqa-portal-issue-card"
            key={issue._id}
            onClick={() => onRowClick(issue._id)}
          >
            <div className="seaqa-portal-issue-card-title">{title}</div>
            <div className="seaqa-portal-issue-card-meta">
              <div className="seaqa-portal-issue-card-state-wrapper">
                <span className={classnames('seaqa-portal-issue-card-state', normalizedState)}>
                  {stateOption?.icon && <Icon symbol={stateOption.icon} />}
                  <span>{stateOption?.statusName || normalizedState || '-'}</span>
                </span>
                {typeOption && <Option option={typeOption} />}
              </div>
              <div className="seaqa-portal-issue-card-priority">
                <PriorityFormatter value={priority} />
              </div>
            </div>
          </div>
        );
      })}
      {isLoadingMore && (
        <div className="seaqa-portal-issue-cards-loading">
          <Loading />
        </div>
      )}
    </div>
  );
};

export default MobileIssueCards;
