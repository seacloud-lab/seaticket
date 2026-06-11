import dayjs from '@/sea-metadata/utils/dayjs';
import { gettext } from '@/constants';
import { DATE_FORMAT } from './constants';

export const getDurationLabel = (startDate, endDate) => {
  const parsedStart = dayjs(startDate);
  const parsedEnd = dayjs(endDate);
  if (!parsedStart || !parsedEnd) return gettext('Date range');
  return `${parsedEnd.diff(parsedStart, 'day') + 1}D`;
};

export const buildPresetRange = (preset, baseStartDate, baseEndDate) => {
  const end = dayjs(baseEndDate);

  if (preset === 'all') {
    return {
      startDate: baseStartDate,
      endDate: end.format(DATE_FORMAT),
    };
  }

  if (preset === 'YTD') {
    return {
      startDate: end.subtract(1, 'year').format(DATE_FORMAT),
      endDate: end.format(DATE_FORMAT),
    };
  }

  const days = Number.parseInt(preset, 10);
  return {
    startDate: end.subtract(days - 1, 'day').format(DATE_FORMAT),
    endDate: end.format(DATE_FORMAT),
  };
};

export const isDisabledPreset = (preset, baseStartDate, baseEndDate) => {
  if (preset === 'all') return false;

  if (preset === 'YTD') {
    const start = dayjs(baseStartDate);
    const end = dayjs(baseEndDate);
    return end.diff(start, 'year', true) < 1;
  }

  const days = dayjs(baseEndDate).diff(dayjs(baseStartDate), 'day') + 1;
  const presetCount = Number.parseInt(preset, 10);
  return days < presetCount;
};
