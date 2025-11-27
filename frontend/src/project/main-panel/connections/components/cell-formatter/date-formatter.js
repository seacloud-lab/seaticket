import { formatWithTimezone, getDateDisplayString } from '@/sea-metadata/utils/column';

const DateFormatter = ({ value, column }) => {
  if (!value) return '---';
  return (
    <span title={formatWithTimezone(value)}>
      {getDateDisplayString(value, column?.data?.format || 'YYYY-MM-DD HH:mm:ss')}
    </span>
  );
};

export default DateFormatter;
