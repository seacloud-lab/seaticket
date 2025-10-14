import React, { forwardRef, useCallback, useEffect, useState, useImperativeHandle } from 'react';
import { gettext, mediaUrl, loginUrl } from '@/constants';
import CenteredLoading from '../centered-loading';
import CenteredError from '../centered-error';
import toaster from '../toaster';
import { Utils } from '@/utils/utils';
import Paginator from '../paginator';
import Project from './project';
import EmptyTip from '../empty-tip';
import FixedWidthTable from '../fixed-width-table';

const AdminProjects = forwardRef(({
  columns,
  placeholder,
  showPaginator = true,
  api,
  onDelete,
  onRestore,
  children,
  ...params
}, ref) => {
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [count, setCount] = useState(0);
  const [hasFreezed, setHasFreezed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = useCallback((page, perPage) => {
    setErrorMessage('');
    api(page, perPage).then((res) => {
      const { projects, count = 0 } = res.data;
      setProjects(projects);
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

  const handleDelete = useCallback((projectUuid) => {
    let newProjects = projects.slice(0);
    const project = projects.find(p => p.uuid === projectUuid);
    if (!project) return;
    onDelete(project).then(res => {
      newProjects = newProjects.filter(p => p.uuid !== projectUuid);
      setProjects(newProjects);
      const msg = gettext('Successfully deleted {name}.').replace('{name}', project.name);
      toaster.success(msg);
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }, [projects, onDelete]);

  const handleRestore = useCallback((projectUuid) => {
    let newProjects = projects.slice(0);
    const project = projects.find(p => p.uuid === projectUuid);
    if (!project) return;
    onRestore(project).then(() => {
      newProjects = newProjects.filter(p => p.uuid !== projectUuid);
      setProjects(newProjects);
      const msg = gettext('Successfully restore {name}.').replace('{name}', project.name);
      toaster.success(msg);
    }).catch((error) => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }, [projects, onRestore]);

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
      setProjects([]);
      setPage(1);
      setHasFreezed(false);
      setCount(0);
    },
    loadData: () => loadData(page, perPage),
  }), [page, perPage, loadData]);

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
  if (projects.length === 0 && placeholder) {
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
        {projects.map((project) => {
          return (
            <Project
              key={project.uuid}
              project={project}
              columns={columns}
              hasFreezed={hasFreezed}
              updateFreezed={updateFreezed}
              onDelete={onDelete ? handleDelete : null}
              onRestore={onRestore ? handleRestore : null}
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

export default AdminProjects;
