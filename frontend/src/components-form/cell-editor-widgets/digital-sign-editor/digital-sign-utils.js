import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { getDigitalSignImageUrl } from 'dtable-utils';
import { concatToStandardUuId } from '../../../workflow/utils/utils';

dayjs.extend(utc);

const { server } = window.app.pageOptions;
const serverUrl = server ? server.replace(/\/+$/, '') : '';

class DigitalSignUtils {

  static parseUrlFromSign(sign) {
    return getDigitalSignImageUrl(sign);
  }

  static getUpdatedSign({ username, sign_image_url }) {
    const time = dayjs().utc().format('YYYY-MM-DDTHH:mm:ss.SSSZ');
    return {
      username,
      sign_image_url,
      sign_time: time,
    };
  }

  static concatToBaseImageUrl(url, editorConfig) {
    if (!url) return '';
    let { workspaceID, dtableUuid } = editorConfig;
    if (!dtableUuid.includes('-')) {
      dtableUuid = concatToStandardUuId(dtableUuid);
    }
    return `${serverUrl}/workspace/${workspaceID}/asset/${dtableUuid}${url}`;
  }

  static concatToThumbnailUrl(url, editorConfig) {
    const size = 256;
    if (!url) return '';
    let { workspaceID, dtableUuid } = editorConfig;
    if (!dtableUuid.includes('-')) {
      dtableUuid = concatToStandardUuId(dtableUuid);
    }
    return `${serverUrl}/thumbnail/workspace/${workspaceID}/asset/${dtableUuid}${url}?size=${size}`;
  }

}

export default DigitalSignUtils;
