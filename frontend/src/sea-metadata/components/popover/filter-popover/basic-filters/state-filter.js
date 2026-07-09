import React, { useCallback, useMemo } from 'react';
import classnames from 'classnames';
import { CustomizeSelect } from '@/components';
import Icon from '@/components/icon';
import { gettext } from '@/constants';
import { getColumnOptions, getOptionDisplayNameByOption } from '@/sea-metadata/utils/column';

import './state-filter.css';

const StateFilter = ({ readOnly = true, value = [], column, onChange: onChangeAPI }) => {

  const options = useMemo(() => {
    const columnOptions = getColumnOptions(column);
    const selectOptions = columnOptions.map(o => {
      const { id } = o;
      const name = getOptionDisplayNameByOption(o);
      return {
        value: id,
        label: (
          <div className="select-basic-filter-option">
            <div className="select-basic-filter-option-name" title={name} aria-label={name}>{name}</div>
            {value.includes(id) && (
              <Icon symbol="check-mark" />
            )}
          </div>
        )
      };
    });
    if (value.length > 0) {
      selectOptions.unshift({
        value: '',
        label: <div className="select-basic-filter-option select-basic-filter-option-empty">--</div>,
      });
    }
    return selectOptions;
  }, [column, value]);

  const displayValue = useMemo(() => ({ label: <>{gettext('State')}</> }), []);

  const onChange = useCallback((newValue) => {
    if (newValue === '') {
      onChangeAPI([]);
      return;
    }
    if (value.includes(newValue)) {
      onChangeAPI(value.filter(v => v !== newValue));
    } else {
      onChangeAPI([...value, newValue]);
    }
  }, [value, onChangeAPI]);

  return (
    <CustomizeSelect
      disabled={readOnly}
      supportMultipleSelect={true}
      className={classnames('sea-metadata-basic-filters-select sea-metadata-table-group-by-basic-checkbox-select seaqa-state-filter mr-4', { 'highlighted': value.length > 0 })}
      value={displayValue}
      options={options}
      onChange={onChange}
    />
  );

};

export default StateFilter;
