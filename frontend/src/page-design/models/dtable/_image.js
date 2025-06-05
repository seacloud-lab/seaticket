const DEFAULT_DATA = {
  width: 150,
  height: 150,
  rotation: 0,
  x: 0,
  y: 0,
  zIndex: 26
};

class _Image {

  constructor(object) {
    // init identification attributes
    const { id, key, type, layout_data } = object;
    this.id = id;
    this.key = key;
    this.type = type;

    // init base attributes
    this.layout_data = Object.assign({}, DEFAULT_DATA, layout_data);

    // init style attributes
    this.config_data = {
      display: 'first_image',
      sizing: 'square_thumbnails',
      imageSize: 150,
      imagePadding: 10,
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
      borderWidth: 3,
      borderRadius: 0
    };
  }

}

export default _Image;
