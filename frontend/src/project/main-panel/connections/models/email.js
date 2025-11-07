class Email {
  constructor(object) {
    this._id = object._pk || '';
    this.email_from = object.email_from || '';
    this.email_to = object.email_to || '';
    this.subject = object.subject || '';
    this.content = object.content || '';
    this.html_content = object.html_content || '';
    this.email_date = object.email_date || '';
    this.is_sender = object.is_sender || '';
    this.deleted = Boolean(object.deleted);
    this.updated_at = object.updated_at || '';
  }
}

export default Email;
