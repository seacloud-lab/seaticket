class ChatSession {
  constructor(object) {
    this._id = object.id;
    this.session_uuid = object.session_uuid || '';
    this.username = object.username || '';
    this.name = object.session_name || '';
    this.created_at = object.created_at || '';
    this.updated_at = object.updated_at || '';
  }
}

export default ChatSession;
