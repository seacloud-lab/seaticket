import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { lang } from '../constants';
import 'dayjs/locale/en';

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
dayjs.locale(lang);

export default dayjs;
