import React from 'react';
import PropTypes from 'prop-types';
import { DTableSelect, DTableSwitch } from 'dtable-ui-component';
import { Col, Input, Row } from 'reactstrap';
import { gettext } from '../../../utils/constants';

class ProcessingTimeLimitSettings extends React.Component {

  constructor(props) {
    super(props);
    const { offsetNumber, unit } = this.getValues(props);
    this.state = {
      offsetNumber: offsetNumber,
      unit: unit
    };
    this.unitOptions = [
      { label: gettext('Day(s)'), value: 'd' },
      { label: gettext('Hour(s)'), value: 'h' },
    ];
  }

  getValues = (props) => {
    let offsetNumber = '';
    let unit = 'd';
    let processingTimeLimit = props.selectedNode.processing_time_limit || '';
    if (/^\+\d+[dh]$/.test(processingTimeLimit)) {
      offsetNumber = processingTimeLimit.slice(1, -1);
      unit = processingTimeLimit.slice(-1);
    }
    return { offsetNumber, unit };
  };

  UNSAFE_componentWillReceiveProps(newProps) {
    const { offsetNumber, unit } = this.getValues(newProps);
    this.setState({
      offsetNumber: offsetNumber,
      unit: unit
    });
  }

  onChangeEnableProcessingTimeLimit = () => {
    this.props.onNodeEnableProcessingTimeLimit(!this.props.selectedNode.enable_processing_time_limit);
  };

  onChangeProcessingTimeLimit = () => {
    const { offsetNumber, unit } = this.state;
    const processingTimeLimit = '+' + offsetNumber + unit;
    this.props.onNodeProcessingTimeLimit(processingTimeLimit);
  };

  onChangeProcessintTimeLimit = (e) => {
    let value = e.target.value.trim();
    if (!value) return;
    if (!/^\d+$/.test(value)) return;
    if (!parseInt(value)) return;
    this.setState({ offsetNumber: value }, () => {
      this.onChangeProcessingTimeLimit();
    });
  };

  onChangeUnit = (e) => {
    this.setState({ unit: e.value }, () => {
      this.onChangeProcessingTimeLimit();
    });
  };

  getUnitOptionValue = () => {
    return this.unitOptions.find(option => option.value === this.state.unit);
  };

  render() {
    const { offsetNumber } = this.state;
    const { selectedNode } = this.props;
    return (
      <div className="setting-item">
        <DTableSwitch
          checked={selectedNode.enable_processing_time_limit}
          onChange={this.onChangeEnableProcessingTimeLimit}
          placeholder={gettext('Processing deadline')}
          switchClassName="form-setting-item"
        />
        {selectedNode.enable_processing_time_limit &&
          <Row className="pt-1" style={{ padding: '0 10px' }}>
            <Col md={6}>
              <Input value={offsetNumber} type='number' min={1} onChange={this.onChangeProcessintTimeLimit} />
            </Col>
            <Col md={6}>
              <DTableSelect
                options={this.unitOptions}
                onChange={this.onChangeUnit}
                value={this.getUnitOptionValue()}
              />
            </Col>
          </Row>
        }
      </div>
    );
  }
}

ProcessingTimeLimitSettings.propTypes = {
  onNodeEnableProcessingTimeLimit: PropTypes.func,
  onNodeProcessingTimeLimit: PropTypes.func,
  selectedNode: PropTypes.object
};

export default ProcessingTimeLimitSettings;
