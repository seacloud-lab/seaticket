
class ChatSession {
  constructor(object) {
    this._id = object.session_uuid || '';
    this.username = object.username || '';
    this.name = object.session_name || '';
    this.created_at = object.created_at || '';
    this.updated_at = object.updated_at || '';

    this.is_replying = false;
    this.problem = null;
  }
}

export default ChatSession;
