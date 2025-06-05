import React from 'react';
import PropTypes from 'prop-types';
import shallowEqual from 'shallowequal';
import { Row, Label } from 'reactstrap';
import FormColorPicker from './form-color-picker';

class FormRemarkTextColorSettings extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      activeColor: '#000000',
    };
  }

  componentDidMount() {
    this.initTextColor(this.props);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.initTextColor(nextProps);
  }

  shouldComponentUpdate(nextProps, nextSate) {
    return !shallowEqual(this.state, nextSate);
  }

  initTextColor = (props) => {
    const { styleConfigData } = props;
    this.setState({ activeColor: styleConfigData.text_color });
  };

  onTextColorChanged = (color) => {
    this.setState({ activeColor: color });
    this.props.onChanged({ text_color: color });
  };

  render() {
    const { titleContent } = this.props;
    const { activeColor } = this.state;

    return (
      <Row className="mt-0 mb-4 ml-0 mr-0 form-remark-settings-color">
        <Label>{titleContent}</Label>
        <FormColorPicker activeColor={activeColor} onColorChanged={this.onTextColorChanged} />
      </Row>
    );
  }
}

FormRemarkTextColorSettings.propTypes = {
  titleContent: PropTypes.string.isRequired,
  styleConfigData: PropTypes.object.isRequired,
  onChanged: PropTypes.func.isRequired
};

export default FormRemarkTextColorSettings;
