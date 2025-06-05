const DEFAULT_DATA = {
  width: 100,
  height: 33,
  rotation: 0,
  x: 0,
  y: 0,
  zIndex: 27,
};

class PageHeader {

  constructor(object) {
    // init identification attributes
    const { id, key, type, layout_data, is_locked } = object;
    this.id = id;
    this.key = key;
    this.type = type;
    this.is_locked = is_locked || false;

    // init width and height
    this.layout_data = Object.assign({}, DEFAULT_DATA, layout_data);

    // init properties
    this.config_data = {
      widgets: [],
    };
  }

}

export default PageHeader;
