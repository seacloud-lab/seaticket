import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { FormGroup, Label } from 'reactstrap';
import { gettext } from '@/constants';
import { VIEW_TYPE } from '../../../../constants';
import StatusFilter from './status-filter';
import TypeFilter from './type-filter';
import TagsFilter from './tags-filter';
import { getColumnByKey } from '@/sea-metadata/utils/column';
import { useTagsData, useTypesData } from '@/sea-metadata/hooks';
import context from '@/sea-metadata/context';

import './index.css';

const BasicFilters = ({ readOnly, filters = [], columns, onChange }) => {

  const { tagsData } = useTagsData();
  const { typesData } = useTypesData();

  const stateColumnKey = useMemo(() => context.getSetting('stateColumnKey', 'status'));
  const typeColumnKey = useMemo(() => context.getSetting('typeColumnKey', 'type'));
  const tagsColumnKey = useMemo(() => context.getSetting('tagsColumnKey', 'tags'));

  const onStatusChange = useCallback((newValue) => {
    const filterIndex = filters.findIndex(filter => filter.column_key === stateColumnKey);
    const filter = filters[filterIndex];
    const newFilters = filters.slice(0);
    newFilters[filterIndex] = { ...filter, filter_term: newValue };
    onChange && onChange(newFilters);
  }, [filters, stateColumnKey, onChange]);

  const onTagsChange = useCallback((newValue) => {
    const filterIndex = filters.findIndex(filter => filter.column_key === tagsColumnKey);
    const filter = filters[filterIndex];
    const newFilters = filters.slice(0);
    newFilters[filterIndex] = { ...filter, filter_term: newValue };
    onChange && onChange(newFilters);
  }, [filters, tagsColumnKey, onChange]);

  const onTypeChange = useCallback((newValue) => {
    const filterIndex = filters.findIndex(filter => filter.column_key === typeColumnKey);
    const filter = filters[filterIndex];
    const newFilters = filters.slice(0);
    newFilters[filterIndex] = { ...filter, filter_term: newValue };
    onChange && onChange(newFilters);
  }, [filters, typeColumnKey, onChange]);

  return (
    <FormGroup className="filter-group-basic filter-group p-4">
      <Label className="filter-group-name">{gettext('Basic')}</Label>
      <div className="filter-group-container">
        <div className="sea-metadata-filters-list">
          {filters.map(filter => {
            const { column_key, filter_term } = filter;
            const column = getColumnByKey(columns, column_key);
            if (column && column_key === stateColumnKey) {
              return (<StatusFilter readOnly={readOnly} value={filter_term} column={column} key={column_key} onChange={onStatusChange} />);
            }
            if (column && column_key === typeColumnKey && typesData) {
              return (<TypeFilter readOnly={readOnly} value={filter_term} key={column_key} onChange={onTypeChange} />);
            }
            if (column && column_key === tagsColumnKey && tagsData) {
              return (<TagsFilter readOnly={readOnly} value={filter_term} key={column_key} onChange={onTagsChange} />);
            }
            return null;
          })}
        </div>
      </div>
    </FormGroup>
  );
};

BasicFilters.propTypes = {
  readOnly: PropTypes.bool,
  filters: PropTypes.array,
  columns: PropTypes.array,
  onChange: PropTypes.func,
  viewType: PropTypes.oneOf(Object.values(VIEW_TYPE)),
};

export default BasicFilters;
