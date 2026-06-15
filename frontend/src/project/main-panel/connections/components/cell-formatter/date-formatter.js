import { ISO } from '@/sea-metadata/constants';
import { formatWithTimezone, getDateDisplayString } from '@/sea-metadata/utils/column';

const DateFormatter = ({ value, column, titleFormat = '', className }) => {
  if (!value) return '--';
  return (
    <span
      title={titleFormat === ISO ? getDateDisplayString(value, ISO) : formatWithTimezone(value)}
      className={className}
    >
      {getDateDisplayString(value, column?.data?.format || 'YYYY-MM-DD HH:mm:ss')}
    </span>
  );
};

export default DateFormatter;
