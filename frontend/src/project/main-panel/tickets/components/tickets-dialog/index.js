import React, { useEffect, useCallback, useState, useRef } from 'react';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import axios from 'axios';
import { gettext, KeyCodes, mediaUrl } from '@/constants';
import { ModalHeader, CenteredLoading, EmptyTip, SearchInput, toaster } from '@/components';
import { Utils } from '@/utils/utils';
import { searchAPI } from '@/project/api';
import {
  PREDEFINED_TICKET_COLUMN_NAME,
  TICKET_COLUMNS_ORDER_CONFIG, TICKET_COLUMNS_WIDTH_CONFIG,
  TICKET_NOT_DISPLAY_COLUMNS, TICKET_PREDEFINED_COLUMN_CONFIG,
} from '../../constants';
import { useMetadata, useTags } from '@/project/hooks';
import Card from '@/sea-metadata/view/card';
import { getColumnByName, normalizeColumns } from '@/sea-metadata/utils/column';
import { Metadata } from '@/sea-metadata/models';
import { TagsDataProvider, TypesDataProvider, SubstatesDataProvider, SelectedRowsProvider, useSelectedRows } from '@/sea-metadata/hooks';
import { getRowById } from '@/sea-metadata/utils/row';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';

import './index.css';

const DEFAULT_TICKETS_DATA = {
  tickets: [],
  columns: [],
  linked_record_titles: {},
};

const Main = ({
  projectUuid,
  onToggle,
  onSubmit,
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ticketsData, setTicketsData] = useState(DEFAULT_TICKETS_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const abortControllerRef = useRef(null);
  const timer = useRef(null);
  const lastSearchValue = useRef('');
  const metadata = useRef({});

  const { tagsData } = useTags();
  const { typesData, substatesData } = useMetadata();
  const { selectedRowIds, updateSelectedRowIds } = useSelectedRows();

  const onSearchValueChange = useCallback((newSearchValue) => {
    if (searchValue === newSearchValue) return;
    setSearchValue(newSearchValue);
  }, [searchValue]);

  const onKeyDown = useCallback((event) => {
    if (
      event.keyCode === KeyCodes.ChineseInputMethod ||
      event.keyCode === KeyCodes.LeftArrow ||
      event.keyCode === KeyCodes.RightArrow
    ) {
      event.stopPropagation();
    }
  }, []);

  const handleSubmit = useCallback(() => {
    setIsSubmitting(true);
    const ticketId = selectedRowIds[0];
    const ticket = getRowById(metadata.current, ticketId);
    const linkedConnectionRecordsColumn = getColumnByName(metadata.current.columns, PREDEFINED_TICKET_COLUMN_NAME.LINKED_CONNECTION_RECORDS);
    const titleColumn = getColumnByName(metadata.current.columns, PREDEFINED_TICKET_COLUMN_NAME.TITLE);
    const title = getCellValueByColumn(ticket, titleColumn);
    onSubmit({ id: ticket._pk, title }, linkedConnectionRecordsColumn, (error) => {
      if (error) {
        setIsSubmitting(false);
        return;
      }
      onToggle && onToggle();
    }, []);
  }, [selectedRowIds, onSubmit, onToggle]);

  const renderTip = useCallback(() => {
    if (isLoading) return null;
    if (!searchValue) {
      return (
        <EmptyTip
          src={`${mediaUrl}img/start-searching.png`}
          text={gettext('Enter characters to start searching')}
          className="option-editor-start-searching-tip"
        />
      );
    }
    if (!Array.isArray(ticketsData.tickets) || ticketsData.tickets.length === 0) {
      return (
        <EmptyTip
          src={`${mediaUrl}img/no-results.png`}
          text={gettext('No results')}
          className="option-editor-no-results-tip"
        />
      );
    }
    return null;
  }, [isLoading, searchValue, ticketsData]);

  const renderTickets = useCallback(() => {
    if (isLoading || !searchValue) return null;
    const { tickets, linked_record_titles } = ticketsData || {};
    if (!Array.isArray(tickets) || tickets.length === 0) return null;
    let columns = ticketsData.columns || [];
    columns = columns.filter(c => !TICKET_NOT_DISPLAY_COLUMNS.includes(c.name)).map(c => {
      const { name } = c;
      const predefinedConfig = TICKET_PREDEFINED_COLUMN_CONFIG[name];
      return {
        ...c,
        ...predefinedConfig,
      };
    });
    columns = normalizeColumns(columns, {}, TICKET_COLUMNS_ORDER_CONFIG);
    metadata.current = new Metadata({ rows: tickets, columns, linked_records: linked_record_titles || {}, columnWidthRules: TICKET_COLUMNS_WIDTH_CONFIG, view: {} });

    return (
      <TagsDataProvider tagsData={tagsData}>
        <TypesDataProvider typesData={typesData} >
          <SubstatesDataProvider substatesData={substatesData}>
            <Card metadata={metadata.current} />
          </SubstatesDataProvider>
        </TypesDataProvider>
      </TagsDataProvider>
    );
  }, [isLoading, searchValue, ticketsData, tagsData, typesData, substatesData]);

  useEffect(() => {
    if (lastSearchValue.current === searchValue) return;
    lastSearchValue.current = searchValue;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    timer.current && clearTimeout(timer.current);
    updateSelectedRowIds([]);
    if (!searchValue) {
      setTicketsData(DEFAULT_TICKETS_DATA);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    timer.current = setTimeout(() => {
      abortControllerRef.current = new AbortController();
      timer.current = null;
      searchAPI.searchTickets(projectUuid, searchValue, abortControllerRef.current.signal).then(res => {
        setTicketsData(res.data);
        setIsLoading(false);
      }).catch(error => {
        if (!axios.isCancel(error)) {
          const errorMessage = Utils.getErrorMsg(error);
          toaster.danger(this.props.gettext(errorMessage));
        }
        setIsLoading(false);
      }).finally(() => {
        abortControllerRef.current = null;
      });
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectUuid, searchValue]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      timer.current && clearTimeout(timer.current);
    };
  }, []);

  return (
    <Modal className="seaqa-tickets-dialog" isOpen={true} toggle={onToggle} style={{ minWidth: 1100 }}>
      <ModalHeader toggle={onToggle}>{gettext('Tickets')}</ModalHeader>
      <ModalBody>
        <div className="seaqa-tickets-search-wrapper">
          <SearchInput
            autoFocus={true}
            value={searchValue}
            size={38}
            placeholder={gettext('Search')}
            onKeyDown={onKeyDown}
            onChange={onSearchValueChange}
            onClear={() => onSearchValueChange('')}
          />
        </div>
        <div className="seaqa-tickets-container">
          {isLoading && (<CenteredLoading />)}
          {renderTip()}
          {renderTickets()}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
        <Button color="primary" disabled={selectedRowIds.length === 0 || isSubmitting} onClick={handleSubmit}>
          {gettext('Submit')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

const TicketsDialog = (props) => {
  return (
    <SelectedRowsProvider>
      <Main { ...props } />
    </SelectedRowsProvider>
  );
};

export default TicketsDialog;
