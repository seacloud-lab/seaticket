import { COMMON_DISPLAY_LABEL_CONFIG } from '../../constants';

const DEFAULT_DATA = {
  width: 150,
  height: 30,
  rotation: 0,
  x: 0,
  y: 0,
  zIndex: 7
};

class Collaborator {

  constructor(object) {
    // init identification attributes
    const { id, key, type, layout_data } = object;
    this.id = id;
    this.key = key;
    this.type = type;

    // init base properties
    this.layout_data = Object.assign({}, DEFAULT_DATA, layout_data);

    // init style properties
    this.config_data = COMMON_DISPLAY_LABEL_CONFIG;
  }

}

export default Collaborator;
