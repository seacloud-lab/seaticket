import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { lang } from './constants';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/de';
import 'dayjs/locale/fr';
import 'dayjs/locale/ru';

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
dayjs.locale(lang);

export default dayjs;
