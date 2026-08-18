import React, { useCallback, useEffect, useMemo, useState } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { CustomizeSelect } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const UNLIMITED_VALUE = 'unlimited';

const YEAR_OPTIONS = [
  { value: UNLIMITED_VALUE, label: gettext('Unlimited') },
  { value: '1', label: gettext('Last 1 year') },
  { value: '2', label: gettext('Last 2 years') },
  { value: '3', label: gettext('Last 3 years') },
  { value: '4', label: gettext('Last 4 years') },
  { value: '5', label: gettext('Last 5 years') },
];

const ALLOWED_YEARS = new Set([1, 2, 3, 4, 5]);

const normalizeValue = (value) => {
  if (ALLOWED_YEARS.has(value)) {
    return String(value);
  }
  return UNLIMITED_VALUE;
};

const IssueSearchYearsSettings = ({
  className,
  value: oldValue = null,
  onChange,
}) => {
  const [value, setValue] = useState(normalizeValue(oldValue));

  useEffect(() => {
    setValue(normalizeValue(oldValue));
  }, [oldValue]);

  const selectedOption = useMemo(() => {
    return YEAR_OPTIONS.find(option => option.value === value) || YEAR_OPTIONS[0];
  }, [value]);

  const onValueChange = useCallback((newValue) => {
    setValue(newValue);
    const years = newValue === UNLIMITED_VALUE ? null : Number(newValue);
    onChange && onChange(years);
  }, [onChange]);

  return (
    <div className={classnames('issue-search-years-settings w-100 pl-4 pr-4', className)}>
      <div className="issue-search-years-settings-header text-truncate">
        {gettext('AI issue search range')}
      </div>
      <div className="issue-search-years-settings-body">
        <CustomizeSelect
          className="issue-search-years-selector"
          value={selectedOption}
          options={YEAR_OPTIONS}
          placeholder={gettext('Select issue search range')}
          onChange={onValueChange}
        />
        <p className="seaqa-tip-default tip m-0">
          {gettext('Only use issues updated within the selected number of years for AI issue search.')}
        </p>
      </div>
    </div>
  );
};

IssueSearchYearsSettings.propTypes = {
  className: PropTypes.string,
  value: PropTypes.oneOf([null, 1, 2, 3, 4, 5]),
  onChange: PropTypes.func,
};

export default IssueSearchYearsSettings;
