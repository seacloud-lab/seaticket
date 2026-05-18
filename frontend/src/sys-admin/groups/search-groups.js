import React, { useCallback, useEffect, useRef, useState } from 'react';
import { navigate } from '@gatsbyjs/reach-router';
import { Button, Col, Form, FormGroup, Label } from 'reactstrap';
import { TopBar, Main } from '../main-panel';
import { gettext } from '@/constants';
import { SearchInput } from '@/components';
import sysAdminAPI from '@/sys-admin/api';
import { isEnter } from '@/utils/hotkey';
import GroupsTable from './groups-table';

const SearchGroups = ({ onCloseSidePanel }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');

  const lastSearchValue = useRef('');
  const ref = useRef(null);

  const onSearch = useCallback((query, page, perPage) => {
    if (lastSearchValue.current === query) return;
    let url = new URL(location.href);
    let searchParams = new URLSearchParams(url.search);
    searchParams.set('query', query);
    url.search = searchParams.toString();
    navigate(url.toString());
    lastSearchValue.current = query;
    return sysAdminAPI.sysAdminSearchGroups(query, page, perPage);
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
        <GroupsTable
          placeholder={gettext('No groups')}
          ref={ref}
          showPaginator={false}
          columns={[
            { name: gettext('Name'), key: 'name', width: 0.2 },
            { name: gettext('Owner'), key: 'owner', width: 0.2 },
            { name: '', key: 'placeholder', width: 0.4 },
            { name: gettext('Created at'), key: 'created_at', width: 0.2 },
            { name: '', key: 'op', width: 44, isFixed: true }
          ]}
          api={(page, perPage) => onSearch(searchValue, page, perPage)}
          onDelete={(group) => sysAdminAPI.sysAdminDismissGroupByID(group.id)}
          onTransfer={(group, userEmail) => sysAdminAPI.sysAdminTransferGroup(userEmail, group.id)}
        >
          <div className="mt-4 mb-6">
            <h4 className="border-bottom font-weight-normal mb-2 pb-1">{gettext('Search groups')}</h4>
            <p className="seaqa-tip-default">{gettext('Tip: you can search by keyword in name.')}</p>
            <Form>
              <FormGroup row>
                <Label for="name" sm={1}>{gettext('Name')}</Label>
                <Col sm={5}>
                  <SearchInput isShowSearchIcon={false} value={searchValue} onChange={onChange} onKeyDown={onKeyDown} />
                </Col>
              </FormGroup>
              <FormGroup row>
                <Col sm={{ size: 5, offset: 1 }}>
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
        </GroupsTable>
      </Main>
    </>
  );
};

export default SearchGroups;

