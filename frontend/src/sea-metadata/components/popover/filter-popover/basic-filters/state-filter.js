import React, { useCallback, useMemo } from 'react';
import classnames from 'classnames';
import { CustomizeSelect } from '@/components';
import { gettext } from '@/constants';
import { getColumnOptions, getOptionDisplayNameByOption } from '@/sea-metadata/utils/column';

const StateFilter = ({ readOnly = true, value = [], column, onChange: onChangeAPI }) => {

  const options = useMemo(() => {
    const columnOptions = getColumnOptions(column);
    const selectOptions = columnOptions.map(o => {
      const { id } = o;
      return {
        value: id,
        label: getOptionDisplayNameByOption(o),
      };
    });
    if (value.length > 0) {
      selectOptions.unshift({
        value: '',
        label: '--',
      });
    }
    return selectOptions;
  }, [column, value]);

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
      className={classnames('sea-metadata-basic-filters-select', { 'highlighted': value.length > 0 })}
      value={value}
      options={options}
      onChange={onChange}
    >
      {gettext('State')}
    </CustomizeSelect>
  );
};

export default StateFilter;
