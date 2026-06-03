class User {

  constructor(obj) {
    this.email = obj.email || '';
    this.name = obj.name || '';
    this.avatar_url = obj.avatar_url || '';
    this.contact_email = obj.contact_email || null;
    this.name_pinyin = obj.name_pinyin || '';
    this.is_admin = obj.is_admin || false;
    this.role = obj.role || '';
  }

}

export default User;
