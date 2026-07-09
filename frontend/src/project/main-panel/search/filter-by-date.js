import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle } from 'reactstrap';
import dayjs from 'dayjs';
import classNames from 'classnames';
import { CustomizeDropdownItem, CustomizeDropdownMenu, Icon, ModalPortal, CustomizeDropdownItemIcon, CustomizeDropdownItemText } from '@/components';
import DateAndTimePicker from './date-and-time-picker';
import { gettext } from '../../../constants';
import { Utils } from '@/utils/utils';
import { SEARCH_FILTERS_KEY, SEARCH_FILTER_BY_DATE_OPTION_KEY, SEARCH_FILTER_BY_DATE_TYPE_KEY } from './constants';

const DATE_INPUT_WIDTH = 118;

const FilterByDate = ({ date, onChange }) => {
  const [value, setValue] = useState(date.value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [isCustomDateHover, setIsCustomDateHover] = useState(false);
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
        id: 'custom-date',
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
  }, [value, onClearDate]);

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
          <CustomizeDropdownMenu className="search-filter-menu filter-by-date-menu">
            {value && (
              <CustomizeDropdownItem
                tag="div"
                tabIndex="-1"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onClearDate}
                toggle={false}
              >
                {'--'}
              </CustomizeDropdownItem>
            )}
            {options.map((option, i) => {
              const isSelected = option.key === value;
              if (option === 'Divider') return <div key={i} className="dropdown-divider"></div>;
              return (
                <CustomizeDropdownItem
                  key={option.key}
                  tag="div"
                  tabIndex="-1"
                  data-toggle={option.key}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onOptionClick}
                  toggle={false}
                  className="justify-content-between position-relative"
                  onMouseEnter={option.id === 'custom-date' ? () => setIsCustomDateHover(true) : undefined }
                  onMouseLeave={option.id === 'custom-date' ? () => setIsCustomDateHover(false) : undefined }
                  style={(isCustomDate && option.id === 'custom-date') ? { borderRadius: '4px 4px 0px 0px' } : {}}
                >
                  <CustomizeDropdownItemText>{option.label}</CustomizeDropdownItemText>
                  {isSelected && <CustomizeDropdownItemIcon symbol="check-mark" position="right" />}
                </CustomizeDropdownItem>
              );
            })}
            {isCustomDate && (
              <div
                className="filter-by-date-custom-date-container-outer pb-1"
                style={{ backgroundColor: isCustomDateHover ? 'rgba(0, 0, 0, 0.04)' : '#fff' }}
              >
                <div className="filter-by-date-custom-date-container p-2 mx-2 d-flex align-items-center justify-content-between border-radius-4">
                  <div className="custom-date-container">
                    <div className="font-size-13 line-height-20 mb-1">{gettext('Start date')}</div>
                    <DateAndTimePicker
                      showHourAndMinute={false}
                      disabledDate={disabledStartDate}
                      value={time.from}
                      onChange={(value) => setTime({ ...time, from: value?.startOf('day') })}
                      inputWidth={DATE_INPUT_WIDTH}
                    />
                  </div>
                  <div className="custom-date-container">
                    <div className="font-size-13 line-height-20 mb-1">{gettext('End date')}</div>
                    <DateAndTimePicker
                      showHourAndMinute={false}
                      disabledDate={disabledEndDate}
                      value={time.to}
                      onChange={(value) => setTime({ ...time, to: value?.endOf('day') })}
                      inputWidth={DATE_INPUT_WIDTH}
                    />
                  </div>
                </div>
              </div>
            )}
          </CustomizeDropdownMenu>
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
