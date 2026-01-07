import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownItem, DropdownMenu, DropdownToggle } from 'reactstrap';
import dayjs from 'dayjs';
import classNames from 'classnames';
import Picker from './date-and-time-picker';
import { gettext } from '../../../constants';
import ModalPortal from '@/components/modal-portal';
import { Utils } from '@/utils/utils';
import Icon from '../../../components/icon';
import { SEARCH_FILTERS_KEY, SEARCH_FILTER_BY_DATE_OPTION_KEY, SEARCH_FILTER_BY_DATE_TYPE_KEY } from './constants';

const DATE_INPUT_WIDTH = 118;

const FilterByDate = ({ date, onChange }) => {
  const [value, setValue] = useState(date.value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [type] = useState(date.type || SEARCH_FILTER_BY_DATE_TYPE_KEY.LAST_UPDATED_TIME);
  const [isCustomDate, setIsCustomDate] = useState(date.value === SEARCH_FILTER_BY_DATE_OPTION_KEY.CUSTOM);
  const [time, setTime] = useState({
    from: date.from,
    to: date.to,
  });

  const options = useMemo(() => {
    return [
      {
        key: SEARCH_FILTER_BY_DATE_OPTION_KEY.TODAY,
        label: gettext('Today'),
      }, {
        key: SEARCH_FILTER_BY_DATE_OPTION_KEY.LAST_7_DAYS,
        label: gettext('Last 7 days'),
      }, {
        key: SEARCH_FILTER_BY_DATE_OPTION_KEY.LAST_30_DAYS,
        label: gettext('Last 30 days'),
      },
      'Divider',
      {
        key: SEARCH_FILTER_BY_DATE_OPTION_KEY.CUSTOM,
        label: gettext('Custom time'),
      },
    ];
  }, []);

  const toggle = useCallback(() => setIsOpen(!isOpen), [isOpen]);

  const onClearDate = useCallback(() => {
    setValue('');
    setIsCustomDate(false);
    setTime({
      from: null,
      to: null,
    });
    setIsOpen(false);
  }, []);

  const onOptionClick = useCallback((e) => {
    const option = Utils.getEventData(e, 'toggle') ?? e.currentTarget.getAttribute('data-toggle');
    if (option === value) {
      onClearDate();
      return;
    }
    const today = dayjs().endOf('day');
    const isCustomOption = option === SEARCH_FILTER_BY_DATE_OPTION_KEY.CUSTOM;
    setIsCustomDate(isCustomOption);
    setValue(option);
    setIsOpen(isCustomOption);
    switch (option) {
      case SEARCH_FILTER_BY_DATE_OPTION_KEY.TODAY: {
        setTime({
          from: dayjs().startOf('day').unix(),
          to: today.unix()
        });
        break;
      }
      case SEARCH_FILTER_BY_DATE_OPTION_KEY.LAST_7_DAYS: {
        setTime({
          from: dayjs().subtract(6, 'day').startOf('day').unix(),
          to: today.unix()
        });
        break;
      }
      case SEARCH_FILTER_BY_DATE_OPTION_KEY.LAST_30_DAYS: {
        setTime({
          from: dayjs().subtract(30, 'day').startOf('day').unix(),
          to: today.unix()
        });
        break;
      }
      case SEARCH_FILTER_BY_DATE_OPTION_KEY.CUSTOM: {
        setTime({
          from: null,
          to: null,
        });
        break;
      }
      default:
        break;
    }
  }, [value]);

  const disabledStartDate = useCallback((startDate) => {
    if (!startDate) return false;
    const today = dayjs();
    const endValue = time.to;

    if (!endValue) {
      return startDate.isAfter(today);
    }
    return endValue.isBefore(startDate) || startDate.isAfter(today);
  }, [time]);

  const disabledEndDate = useCallback((endDate) => {
    if (!endDate) return false;
    const today = dayjs().endOf('day');
    const startValue = time.from;
    if (!startValue) {
      return endDate.isAfter(today);
    }
    return endDate.isBefore(startValue) || endDate.isAfter(today);
  }, [time]);

  useEffect(() => {
    if (!isOpen) {
      if (type !== date.type || time.from !== date.from || time.to !== date.to) {
        onChange(SEARCH_FILTERS_KEY.DATE, {
          type,
          value,
          from: time.from,
          to: time.to,
        });
      }
    }
  }, [isOpen, date, time, type, value, onChange]);

  return (
    <div className="search-filter filter-by-date-container">
      <Dropdown isOpen={isOpen} toggle={toggle}>
        <DropdownToggle
          tag="div"
          className={classNames('search-filter-toggle', { 'active': isOpen && value, 'highlighted': value })}
          onClick={toggle}
        >
          <div className="filter-label" style={{ maxWidth: 300 }} title={gettext('Last modified time')}>
            {gettext('Last modified time')}
          </div>
          <Icon symbol="arrow-down"/>
        </DropdownToggle>
        <ModalPortal>
          <DropdownMenu className="sea-qa-dropdown-menu search-filter-menu filter-by-date-menu">
            {options.map((option, i) => {
              const isSelected = option.key === value;
              if (option === 'Divider') return <div key={i} className="seafile-divider dropdown-divider"></div>;
              return (
                <DropdownItem
                  key={option.key}
                  tag="div"
                  tabIndex="-1"
                  data-toggle={option.key}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onOptionClick}
                  toggle={false}
                >
                  {option.label}
                  {isSelected && <Icon symbol="check-mark" className="dropdown-item-tick" />}
                </DropdownItem>
              );
            })}
            {isCustomDate && (
              <div className="filter-by-date-custom-date-container">
                <div className="custom-date-container">
                  <div className="custom-date-label">{gettext('Start date')}</div>
                  <Picker
                    showHourAndMinute={false}
                    disabledDate={disabledStartDate}
                    value={time.from}
                    onChange={(value) => setTime({ ...time, from: value?.startOf('day') })}
                    inputWidth={DATE_INPUT_WIDTH}
                  />
                </div>
                <div className="custom-date-container">
                  <div className="custom-date-label">{gettext('End date')}</div>
                  <Picker
                    showHourAndMinute={false}
                    disabledDate={disabledEndDate}
                    value={time.to}
                    onChange={(value) => setTime({ ...time, to: value?.endOf('day') })}
                    inputWidth={DATE_INPUT_WIDTH}
                  />
                </div>
              </div>
            )}
          </DropdownMenu>
        </ModalPortal>
      </Dropdown>
    </div>
  );
};

FilterByDate.propTypes = {
  date: PropTypes.shape({
    type: PropTypes.string,
    value: PropTypes.string,
    start: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
    end: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
  }),
  onChange: PropTypes.func.isRequired,
};

export default FilterByDate;
