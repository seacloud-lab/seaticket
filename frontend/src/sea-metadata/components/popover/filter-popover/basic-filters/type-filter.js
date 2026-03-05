import React, { useCallback, useMemo } from 'react';
import classnames from 'classnames';
import { CustomizeSelect } from '@/components';
import { gettext } from '@/constants';
import { useTypesData } from '@/sea-metadata/hooks';
import { getOptionDisplayNameByOption } from '@/sea-metadata/utils/column';

const TypeFilter = ({ readOnly = true, value = [], onChange: onChangeAPI }) => {

  const { typesData } = useTypesData();

  const options = useMemo(() => {
    return typesData && typesData.rows ? typesData.rows.map(type => {
      const { _id } = type;
      const name = getOptionDisplayNameByOption(type);
      return {
        ...type,
        value: _id,
        label: (
          <>
            <div className="select-basic-filter-option">
              <div className="select-basic-filter-option-checkbox mr-2">
                <input type="checkbox" checked={value.includes(_id)} readOnly />
              </div>
              <div className="select-basic-filter-option-name" title={name} aria-label={name}>{name}</div>
            </div>
          </>
        ),
      };
    }) : [];
  }, [typesData, value]);

  const displayValue = useMemo(() => ({ label: <>{gettext('Type')}</> }), [value]);

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
      className={classnames('sea-metadata-basic-filters-select sea-metadata-table-group-by-basic-checkbox-select mr-4', { 'highlighted': value.length > 0 })}
      value={displayValue}
      noOptionsPlaceholder={gettext('No available types')}
      options={options}
      onChange={onChange}
    />
  );

};

export default TypeFilter;
