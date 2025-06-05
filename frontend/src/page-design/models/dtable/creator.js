const DEFAULT_DATA = {
  width: 150,
  height: 20,
  rotation: 0,
  x: 0,
  y: 0,
  zIndex: 7
};

class Creator {

  constructor(object) {
    // init identification attributes
    const { id, key, type, layout_data } = object;
    this.id = id;
    this.key = key;
    this.type = type;

    // init base properties
    this.layout_data = Object.assign({}, DEFAULT_DATA, layout_data);

    // init style properties
    this.config_data = {
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
      borderWidth: 3,
      borderRadius: 0
    };
  }

}

export default Creator;
