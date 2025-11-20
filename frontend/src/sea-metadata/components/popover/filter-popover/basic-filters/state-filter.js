import React, { useCallback, useMemo } from 'react';
import classnames from 'classnames';
import { CustomizeSelect } from '@/components';
import { gettext } from '@/constants';
import { getColumnOptions, getOptionDisplayNameByOption } from '@/sea-metadata/utils/column';

const StateFilter = ({ readOnly = true, value = [], column, onChange: onChangeAPI }) => {

  const options = useMemo(() => {
    const columnOptions = getColumnOptions(column);
    return columnOptions.map(o => {
      const { id } = o;
      const name = getOptionDisplayNameByOption(o);
      return {
        value: id,
        label: (
          <div className="select-basic-filter-option">
            <div className="select-basic-filter-option-checkbox mr-2">
              <input type="checkbox" checked={value.includes(id)} readOnly />
            </div>
            <div className="select-basic-filter-option-name" title={name} aria-label={name}>{name}</div>
          </div>
        )
      };
    });
  }, [column, value]);

  const displayValue = useMemo(() => ({ label: <>{gettext('State')}</> }), [value]);

  const onChange = useCallback((newValue) => {
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
      className={classnames('sea-metadata-basic-filters-select sea-metadata-table-view-basic-checkbox-select mr-4', { 'highlighted': value.length > 0 })}
      value={displayValue}
      options={options}
      onChange={onChange}
    />
  );

};

export default StateFilter;
