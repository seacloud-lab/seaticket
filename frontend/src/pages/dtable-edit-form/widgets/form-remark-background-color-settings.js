import React from 'react';
import PropTypes from 'prop-types';
import shallowEqual from 'shallowequal';
import { Row, Label } from 'reactstrap';
import FormSelectGroup from '../select/form-select-group';
import FormColorPicker from './form-color-picker';
import { BACKGROUND_TYPE, TRANSPARENT_COLOR, FORM_REMARK_DEFAULT_BACKGROUND_COLOR } from '../../../constants/form-constants';

const gettext = window.gettext;

export default class FormRemarkBackgroundColorSettings extends React.Component {

  static propTypes = {
    title: PropTypes.string,
    styleConfigData: PropTypes.object.isRequired,
    onChanged: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      activeOption: BACKGROUND_TYPE.TRANSPARENT,
      activeColor: FORM_REMARK_DEFAULT_BACKGROUND_COLOR,
    };
  }

  componentDidMount() {
    this.initActiveOption(this.props);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.initActiveOption(nextProps);
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !shallowEqual(nextState, this.state);
  }

  initActiveOption = (props) => {
    const { styleConfigData } = props;
    const { background_color } = styleConfigData;
    const activeOption = background_color === TRANSPARENT_COLOR ? BACKGROUND_TYPE.TRANSPARENT : BACKGROUND_TYPE.FILLED;
    this.setState({
      activeOption: activeOption,
      activeColor: background_color
    });
  };

  onBackgroundChanged = (option) => {
    const activeColor = option === BACKGROUND_TYPE.TRANSPARENT ? TRANSPARENT_COLOR : FORM_REMARK_DEFAULT_BACKGROUND_COLOR;
    this.setState({ activeOption: option, activeColor });
    this.props.onChanged({ background_color: activeColor });
  };

  onBackGroundColorChanged = (color) => {
    this.setState({ activeColor: color });
    this.props.onChanged({ background_color: color });
  };

  render() {
    const { activeOption, activeColor } = this.state;
    return (
      <div className="form-remark-background-setting">
        <Row className="mt-0 mb-4 ml-0 mr-0 settings-background">
          <Label>{this.props.title || gettext('Background color')}</Label>
          <FormSelectGroup
            activeOption={activeOption}
            onSelectChanged={this.onBackgroundChanged}
          />
        </Row>
        {activeOption === BACKGROUND_TYPE.FILLED && (
          <Row className="mt-0 mb-4 ml-0 mr-0 form-remark-settings-color">
            <FormColorPicker
              activeColor={activeColor}
              onColorChanged={this.onBackGroundColorChanged}
            />
          </Row>
        )}
      </div>
    );
  }
}
