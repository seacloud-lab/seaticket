const DEFAULT_DATA = {
  width: 200,
  height: 33,
  rotation: 0,
  x: 0,
  y: 0,
  zIndex: 7
};

class ViewName {

  constructor(object) {
    // init identification attributes
    const { id, key, type, layout_data, is_locked } = object;
    this.id = id;
    this.key = key;
    this.type = type;
    this.is_locked = is_locked || false;

    // init width and height
    this.layout_data = Object.assign({}, DEFAULT_DATA, layout_data);

    // init style properties
    this.config_data = {
      order: '',
      font: 'Arial',
      fontSize: 13,
      fontWeight: 400,
      lineHeight: 1.4,
      horizontalAlign: 'left',
      verticalAlign: 'top',
      textColor: '#000000',
      background: 'transparent',
      backgroundColor: '#ffffff',
      padding: 0,
      borders: {
        left: false,
        right: false,
        top: false,
        bottom: false
      },
      borderColor: '#000000',
      borderWidth: 1,
      borderRadius: 0
    };
  }

}

export default ViewName;
