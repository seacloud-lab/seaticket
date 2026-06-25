import React, { useCallback, useEffect, useRef, useState } from 'react';
import { navigate } from '@gatsbyjs/reach-router';
import { Button, Col, Form, FormGroup } from 'reactstrap';
import { TopBar, Main } from '../main-panel';
import { gettext } from '@/constants';
import { ProjectsTable, SearchInput } from '@/components';
import sysAdminAPI from '@/sys-admin/api';
import { isEnter } from '@/utils/hotkey';

const SearchProjects = ({ onCloseSidePanel }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');

  const lastSearchValue = useRef('');
  const ref = useRef(null);

  const onSearch = useCallback((query, page, perPage) => {
    if (lastSearchValue.current !== query) {
      let url = new URL(location.href);
      let searchParams = new URLSearchParams(url.search);
      searchParams.set('query', query);
      url.search = searchParams.toString();
      navigate(url.toString());
      lastSearchValue.current = query;
    }
    return sysAdminAPI.sysAdminSearchProjects(query, page, perPage);
  }, []);

  const onChange = useCallback((value) => {
    setSearchValue(value);
  }, []);

  const loadData = useCallback((page, perPage) => {
    return ref.current.loadData(searchValue, page, perPage);
  }, [searchValue]);

  const onKeyDown = useCallback((event) => {
    if (isEnter(event)) {
      event.preventDefault();
      event.stopPropagation();
      loadData();
      return;
    }
  }, [loadData]);

  useEffect(() => {
    const params = (new URL(document.location)).searchParams;
    const searchValue = params.get('query', '') || '';
    setSearchValue(searchValue);
    setIsLoading(false);
  }, []);

  if (isLoading) return null;

  return (
    <>
      <TopBar onCloseSidePanel={onCloseSidePanel} />
      <Main title={gettext('Projects')} className="mb-6">
        <ProjectsTable
          placeholder={gettext('No projects')}
          ref={ref}
          columns={[
            { name: '', key: 'icon', width: 44, isFixed: true },
            { name: gettext('Name'), key: 'name', width: 0.18 },
            { name: 'ID', key: 'uuid', width: 0.32 },
            { name: 'Owner', key: 'owner', width: 0.25 },
            { name: gettext('Created at'), key: 'created_at', type: 'date', width: 0.15 },
            { name: '', key: 'placeholder', width: 0.1 },
            { name: '', key: 'op', width: 44, isFixed: true }
          ]}
          api={(page, perPage) => onSearch(searchValue, page, perPage)}
          onDelete={(project) => sysAdminAPI.sysAdminDeleteProject(project.uuid)}
        >
          <div className="mt-4 mb-6">
            <h4 className="border-bottom font-weight-normal mb-2 pb-1">{gettext('Search projects')}</h4>
            <Form>
              <FormGroup row>
                <Col sm={5}>
                  <SearchInput isShowSearchIcon={false} value={searchValue} onChange={onChange} onKeyDown={onKeyDown} />
                </Col>
              </FormGroup>
              <FormGroup row>
                <Col sm={{ size: 5 }}>
                  <Button color="outline-primary" disabled={!searchValue.trim()} onClick={loadData} >
                    {gettext('Submit')}
                  </Button>
                </Col>
              </FormGroup>
            </Form>
          </div>
          <div className="mt-4">
            <h4 className="border-bottom font-weight-normal mb-2 pb-1">{gettext('Result')}</h4>
          </div>
        </ProjectsTable>
      </Main>
    </>
  );
};

export default SearchProjects;
