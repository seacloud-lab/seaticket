const DEFAULT_DATA = {
  width: 80,
  height: 26,
  rotation: 0,
  x: 0,
  y: 0,
  zIndex: 7
};

class Button {

  constructor(object) {
    // init identification attributes
    const { id, key, type, layout_data, column_data, optionColors } = object;
    this.id = id;
    this.key = key;
    this.type = type;

    // init base properties
    this.layout_data = Object.assign({}, DEFAULT_DATA, layout_data);

    const { button_color } = column_data || {};
    let colorOption = Array.isArray(optionColors) ?
      (optionColors.find(item => item.COLOR === button_color) || optionColors[0])
      :
      { COLOR: '#FFFCB5', BORDER_COLOR: '#E8E79D', TEXT_COLOR: '#212529' };

    // init style properties
    this.config_data = {
      font: 'Arial',
      fontSize: 13,
      fontWeight: 400,
      lineHeight: 1.4,
      horizontalAlign: 'left',
      verticalAlign: 'top',
      textColor: colorOption.TEXT_COLOR,
      background: 'filled',
      backgroundColor: colorOption.COLOR,
      borders: {
        left: true,
        right: true,
        top: true,
        bottom: true
      },
      borderColor: colorOption.BORDER_COLOR,
      borderWidth: 1,
      borderRadius: 3
    };
  }

}

export default Button;
