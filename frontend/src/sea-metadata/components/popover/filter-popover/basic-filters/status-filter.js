import React, { useCallback, useMemo } from 'react';
import { CustomizeSelect, Icon } from '@/components';
import { gettext } from '@/constants';

const OPTIONS = [
  { value: 'open', name: gettext('State: open') },
  { value: 'closed', name: gettext('State: closed') },
  { value: 'all', name: gettext('State') },
];

const StatusFilter = ({ readOnly = true, value = 'all', onChange: onChangeAPI }) => {

  const options = useMemo(() => {
    return OPTIONS.map(o => {
      const { name } = o;
      return {
        value: o.value,
        label: (
          <div className="select-basic-filter-option">
            <div className="select-basic-filter-option-name" title={name} aria-label={name}>{name}</div>
            <div className="select-basic-filter-option-check-icon">
              {value === o.value && ((<Icon symbol="check-mark" />))}
            </div>
          </div>
        )
      };
    });
  }, [value]);

  const displayValue = useMemo(() => {
    const selectedOption = OPTIONS.find(o => o.value === value) || OPTIONS[2];
    return { label: <>{selectedOption.name}</> };
  }, [value]);

  const onChange = useCallback((newValue) => {
    if (newValue === value) return;
    onChangeAPI(newValue);
  }, [value, onChangeAPI]);

  return (
    <CustomizeSelect
      disabled={readOnly}
      className="sea-metadata-basic-filters-select mr-4"
      value={displayValue}
      options={options}
      onChange={onChange}
    />
  );

};

export default StatusFilter;
