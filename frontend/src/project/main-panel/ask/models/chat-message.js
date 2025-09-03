import slugid from 'slugid';
import { getTime } from '@/utils/date';

class ChatMessage {
  constructor(object) {
    this._id = object.id || slugid.nice();
    this.messages = object.messages || [];
    this.isUserSpeak = object.isUserSpeak || false;
    this.time = object.time || getTime(new Date());
    this.type = object.type || '';
  }
}

export default ChatMessage;
