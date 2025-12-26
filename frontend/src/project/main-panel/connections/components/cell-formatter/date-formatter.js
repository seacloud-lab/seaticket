import { formatWithTimezone, getDateDisplayString } from '@/sea-metadata/utils/column';

const DateFormatter = ({ value, column, className }) => {
  if (!value) return '--';
  return (
    <span title={formatWithTimezone(value)} className={className}>
      {getDateDisplayString(value, column?.data?.format || 'YYYY-MM-DD HH:mm:ss')}
    </span>
  );
};

export default DateFormatter;
