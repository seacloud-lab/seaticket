import React, { forwardRef, useCallback, useEffect, useState, useImperativeHandle } from 'react';
import { gettext, mediaUrl, loginUrl } from '@/constants';
import { Utils } from '@/utils/utils';
import { Paginator, toaster, CenteredLoading, CenteredError, EmptyTip, FixedWidthTable } from '@/components';
import Group from './group';

const GroupsTable = forwardRef(({
  columns,
  placeholder = gettext('No groups'),
  showPaginator = true,
  api,
  onDelete,
  onTransfer,
  onUserRemove,
  children,
  ...params
}, ref) => {
  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [count, setCount] = useState(0);
  const [hasFreezed, setHasFreezed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = useCallback((page, perPage) => {
    setErrorMessage('');
    api(page, perPage).then((res) => {
      const { groups, count = 0 } = res.data;
      setGroups(groups);
      setCount(count);
      setIsLoading(false);
    }).catch(error => {
      if (error?.response?.status === 403) {
        setErrorMessage(gettext('Permission denied'));
        setIsLoading(false);
        location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
      }

      const errMessage = Utils.getErrorMsg(error);
      setErrorMessage(errMessage);
      setIsLoading(false);
    });
  }, [api]);

  const updateFreezed = useCallback((hasFreezed) => {
    setHasFreezed(hasFreezed);
  }, []);

  const getPreviousPageProjects = useCallback(() => {
    const previousPage = page - 1;
    setPage(previousPage);
    loadData(previousPage, perPage);
  }, [page, perPage, loadData]);

  const getNextPageProjects = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadData(nextPage, perPage);
  }, [page, perPage, loadData]);

  const resetPerPage = useCallback((perPage) => {
    setPerPage(perPage);
    setPage(1);
    loadData(1, perPage);
  }, []);

  const handleDelete = useCallback((groupId) => {
    let newGroups = groups.slice(0);
    const group = groups.find(p => p.id === groupId);
    if (!group) return;
    onDelete(group).then(res => {
      newGroups = newGroups.filter(p => p.id !== groupId);
      setGroups(newGroups);
      const msg = gettext('Successfully deleted {name}.').replace('{name}', group.name);
      toaster.success(msg);
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }, [groups, onDelete]);

  const handleUserRemove = useCallback((groupId) => {
    let newGroups = groups.slice(0);
    const group = groups.find(p => p.id === groupId);
    if (!group) return;
    onUserRemove(group).then(() => {
      newGroups = newGroups.filter(p => p.id !== groupId);
      setGroups(newGroups);
      const msg = gettext('Successfully remove from 1 item.');
      toaster.success(msg);
    }).catch((error) => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }, [groups, onUserRemove]);

  const handleTransfer = useCallback((groupId, userEmail) => {
    let newGroups = groups.slice(0);
    const group = groups.find(p => p.id === groupId);
    if (!group) return;
    onTransfer(group, userEmail).then(res => {
      newGroups = newGroups.map(group => {
        if (group.id === groupId) return res.data;
        return group;
      });
      setGroups(newGroups);
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }, [groups, onTransfer]);

  useEffect(() => {
    const params = (new URL(document.location)).searchParams;
    const page = parseInt(params.get('page') || 1);
    const perPage = parseInt(parseInt(params.get('per_page') || 25));
    setPage(page);
    setPerPage(perPage);
    loadData(page, perPage);
  }, []);

  useImperativeHandle(ref, () => ({
    reset: () => {
      setGroups([]);
      setPage(1);
      setHasFreezed(false);
      setCount(0);
    },
    loadData: () => loadData(page, perPage),
    addGroups: (addedGroups = []) => {
      let newGroups = groups.slice(0);
      newGroups = addedGroups.concat(groups);
      setGroups(newGroups);
    },
    getGroups: () => groups,
    addToGroups: (targetGroups) => {
      let newGroups = groups.slice(0);
      targetGroups.forEach(group => {
        const isExist = newGroups.find(item => item.id === group.group_id);
        if (isExist) return;
        newGroups.push(group);
      });
      setGroups(newGroups);
    },
  }), [page, perPage, groups, loadData]);

  if (isLoading) {
    return (
      <>
        {children}
        <CenteredLoading />
      </>
    );
  }
  if (errorMessage) {
    return (
      <>
        {children}
        <CenteredError>{errorMessage}</CenteredError>
      </>
    );
  }
  if (groups.length === 0 && placeholder) {
    return (
      <>
        {children}
        <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={placeholder} />
      </>
    );
  }

  return (
    <>
      {children}
      <FixedWidthTable columns={columns}>
        {groups.map((group) => {
          return (
            <Group
              key={group.id}
              group={group}
              columns={columns}
              hasFreezed={hasFreezed}
              updateFreezed={updateFreezed}
              onDelete={onDelete ? handleDelete : null}
              onUserRemove={onUserRemove ? handleUserRemove : null}
              onTransfer={onTransfer ? handleTransfer : null}
              { ...params }
            />
          );
        })}
      </FixedWidthTable>
      {showPaginator && (
        <Paginator
          goPreviousPage={getPreviousPageProjects}
          goNextPage={getNextPageProjects}
          currentPage={page}
          hasNextPage={Utils.hasNextPage(page, perPage, count)}
          canResetPerPage={true}
          curPerPage={perPage}
          resetPerPage={resetPerPage}
        />
      )}
    </>
  );
});

export default GroupsTable;
