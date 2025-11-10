class Email {
  constructor(object) {
    this._id = object._pk || '';
    this.email_from = object.email_from || '';
    this.email_to = object.email_to || '';
    this.subject = object.title || '';
    this.content = object.content || '';
    this.modified_time = object.modified_time || '';
    this.is_sender = object.is_sender || '';
    this.deleted = Boolean(object.deleted);
    this.sync_time = object.sync_time || '';
  }
}

export default Email;
