import React, { useCallback, useMemo } from 'react';
import { gettext, mediaUrl } from '@/constants';
import {
  CenteredError,
  CenteredLoading, EmptyTip, FixedWidthTable,
  Paginator
} from '@/components';
import StatisticItem from './statistic-item';


const StatisticList = ({
  loading, errorMsg, items, groupBy,
  pageInfo, curPerPage, resetPerPage, getStatisticsByPage,
  hasFreezed, updateFreezed,
  onOpenAIStaticsDetailDialog,
}) => {
  const columns = useMemo(() => {
    if (groupBy === 'user') {
      return [
        { key: 'user', name: gettext('User'), width: 0.8 },
        { key: 'credit_used', name: gettext('Credit used'), width: 0.2 },
        { key: 'op', width: 44, isFixed: true },
      ];
    }
    if (groupBy === 'project') {
      return [
        { key: 'project', name: gettext('Project'), width: 0.4 },
        { key: 'owner', name: gettext('Owner'), width: 0.4 },
        { key: 'credit_used', name: gettext('Credit used'), width: 0.2 },
        { key: 'op', width: 44, isFixed: true },
      ];
    }
    return [
      { key: 'group', name: gettext('Group'), width: 0.4 },
      { key: 'owner', name: gettext('Owner'), width: 0.4 },
      { key: 'credit_used', name: gettext('Credit used'), width: 0.2 },
      { key: 'op', width: 44, isFixed: true },
    ];
  }, [groupBy]);

  const getPreviousPage = useCallback(() => {
    getStatisticsByPage(pageInfo.current_page - 1);
  }, [pageInfo, getStatisticsByPage]);

  const getNextPage = useCallback(() => {
    getStatisticsByPage(pageInfo.current_page + 1);
  }, [pageInfo, getStatisticsByPage]);

  if (loading) return (<CenteredLoading />);

  if (errorMsg) return (<CenteredError>{errorMsg}</CenteredError>);

  if (items.length === 0) return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} title={gettext('No items')}/>);

  return (
    <>
      <FixedWidthTable
        columns={columns}
      >
        {items.map((item, index) => (
          <StatisticItem
            key={index}
            item={item}
            groupBy={groupBy}
            hasFreezed={hasFreezed}
            updateFreezed={updateFreezed}
            onOpenAIStaticsDetailDialog={onOpenAIStaticsDetailDialog}
          />
        ))}
      </FixedWidthTable>
      <Paginator
        goPreviousPage={getPreviousPage}
        goNextPage={getNextPage}
        currentPage={pageInfo.current_page}
        hasNextPage={pageInfo.has_next_page}
        canResetPerPage={true}
        curPerPage={curPerPage}
        resetPerPage={resetPerPage}
      />
    </>
  );
};

export default StatisticList;
