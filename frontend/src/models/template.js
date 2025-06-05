class Template {

  constructor(object) {
    this.name = object.name || '';
    this.display_name = object.display_name || '';
    this.category = object.category || '';
    this.link = object.link || '';
    this.card_image_url = object.card_image_url || '';
    this.description = object.description || '';
    this.card_image_expanded_url = object.card_image_expanded_url || '';
  }

}

export default Template;
