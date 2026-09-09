import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import { lang } from '../constants';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/de';
import 'dayjs/locale/fr';
import 'dayjs/locale/en';

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
dayjs.locale(lang);

export default dayjs;
