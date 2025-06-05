const DEFAULT_DATA = {
  width: 150,
  height: 150,
  rotation: 0,
  x: 0,
  y: 0,
  zIndex: 26
};

class DigitalSign {

  constructor(object) {
    // init identification attributes
    const { id, key, type, layout_data, is_locked } = object;
    this.id = id;
    this.key = key;
    this.type = type;
    this.is_locked = is_locked || false;

    // init base properties
    this.layout_data = Object.assign({}, DEFAULT_DATA, layout_data);

    // init style properties
    this.config_data = {
      order: '',
      fitMode: 'fit',
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

export default DigitalSign;
