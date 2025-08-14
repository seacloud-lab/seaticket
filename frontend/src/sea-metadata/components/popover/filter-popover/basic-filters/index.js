import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { FormGroup, Label } from 'reactstrap';
import { gettext } from '@/constants';
import { VIEW_TYPE } from '../../../../constants';
import StatusFilter from './status-filter';

import './index.css';

const BasicFilters = ({ filters = [], onChange }) => {

  const onStatusChange = useCallback((newValue) => {
    const filterIndex = filters.findIndex(filter => filter.column_key === 'status');
    const filter = filters[filterIndex];
    const newFilters = filters.slice(0);
    newFilters[filterIndex] = { ...filter, filter_term: newValue };
    onChange && onChange(newFilters);
  }, [filters, onChange]);

  return (
    <FormGroup className="filter-group-basic filter-group p-4">
      <Label className="filter-group-name">{gettext('Basic')}</Label>
      <div className="filter-group-container">
        <div className="sea-metadata-filters-list">
          {filters.map(filter => {
            const { column_key, filter_term } = filter;
            if (column_key === 'status') {
              return (<StatusFilter value={filter_term} key={column_key} onChange={onStatusChange} />);
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
