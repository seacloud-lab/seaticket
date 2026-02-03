import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { gettext, mediaUrl } from '@/constants';
import { Loading, EmptyTip, TokenCostChart, OptionEditor, ModalHeader } from '@/components';
import { Modal, ModalBody, Label } from 'reactstrap';
import DateAndTimePicker from '@/project/main-panel/search/date-and-time-picker';

import './index.css';

class TokenCostDetailDialog extends Component {
  constructor(props) {
    super(props);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    this.state = {
      isLoading: true,
      group_by: props.group_by || 'user',
      condition: props.condition || '',
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      models: [], // models from fetchModels
      selectedModels: [], // selected models
      fullData: null,
      data: null,
      isOptionEditorOpen: false
    };

    this.optionEditorTarget = React.createRef();
  }

  componentDidMount() {
    this.initializeData();
  }

  componentDidUpdate(prevProps, prevState) {
    // re-fetch model when group_by has changed
    if (prevState.group_by !== this.state.group_by ||
        prevState.condition !== this.state.condition) {
      this.fetchModels();
    }
  }

  initializeData = async () => {
    await this.fetchModels();
  };

  setDefaultSelectedModels = () => {
    // set default models
    if (this.state.models.length > 0) {
      const allModels = this.state.models.map(model => model.value);
      this.setState({ selectedModels: allModels });
    }
  };

  fetchModels = async () => {
    this.setState({ isLoading: true });
    try {
      const { group_by, condition } = this.state;

      const models = await this.props.getModels(group_by, condition);

      this.setState({
        models: Array.isArray(models) ? models : [],
      });
      this.setDefaultSelectedModels();
      await this.fetchStatistics();
    } catch (error) {
      this.setState({ isLoading: false });
    }
  };

  updateDataByDate = () => {
    const { fullData, startDate, endDate } = this.state;
    if (!fullData || !fullData.length === 0) {
      this.setState({ data: null, isLoading: false });
      return;
    }

    let new_data = [];

    fullData.forEach((data) => {
      if (data.date && data.date >= startDate && data.date <= endDate) {
        new_data.push({
          date: data.date,
          input_tokens: data.total_input_tokens || 0,
          output_tokens: data.total_output_tokens || 0,
          cost: data.total_cost || 0,
          total_tokens: (data.total_input_tokens || 0) + (data.total_output_tokens || 0)
        });
      }
    });

    this.setState({ data: new_data, isLoading: false });
  };

  fetchStatistics = async () => {
    try {
      const { selectedModels, group_by, condition } = this.state;

      if (!selectedModels || selectedModels.length === 0) {
        this.setState({ fullData: null, date: null, isLoading: false });
        return;
      }

      const fullData = await this.props.getAIStatisticsDetail(
        selectedModels,
        group_by,
        condition
      );

      this.setState({ fullData: fullData || null });

      this.updateDataByDate();
    } catch (error) {
      this.setState({ isLoading: false });
    }
  };

  onDateChange = (date, type) => {
    if (type === 'start') {
      this.setState({ startDate: date }, () => {
        this.setState({ isLoading: true });
        this.updateDataByDate();
      });
    } else if (type === 'end') {
      this.setState({ endDate: date }, () => {
        this.setState({ isLoading: true });
        this.updateDataByDate();
      });
    }
  };

  updateFilterModels = (selectedModels) => {
    this.setState({ selectedModels }, () => {
      this.setState({ isLoading: true });
      this.fetchStatistics();
    });
  };

  openOptionEditor = () => {
    this.setState({ isOptionEditorOpen: true });
  };

  closeOptionEditor = () => {
    this.setState({ isOptionEditorOpen: false });
  };

  render() {
    const {
      isLoading,
      startDate,
      endDate,
      models,
      selectedModels,
      data,
    } = this.state;

    return (
      <Modal isOpen={true} toggle={this.props.onCloseDialog} autoFocus={false} className="ai-statistics-dialog">
        <ModalHeader toggle={this.props.onCloseDialog}>{gettext('Token cost statistics detail')}</ModalHeader>
        <ModalBody className="dialog-content">
          <div className="filters-section">
            <div className="filter-row">
              <div className="filter-item full-width">
                <Label>{gettext('Date range')}</Label>
                <div className="date-range-row">
                  <div className="date-range-item">
                    <DateAndTimePicker
                      showHourAndMinute={false}
                      disabledDate={() => false}
                      value={startDate}
                      onChange={(date) => this.onDateChange(date, 'start')}
                      inputWidth={140}
                    />
                  </div>
                  <Label> - </Label>
                  <div className="date-range-item">
                    <DateAndTimePicker
                      showHourAndMinute={false}
                      disabledDate={(date) => {
                        return date <= new Date(startDate);
                      }}
                      value={endDate}
                      onChange={(date) => this.onDateChange(date, 'end')}
                      inputWidth={140}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="models-section">
            <OptionEditor
              className="sea-qa-ai-chat-tool-type-select-editor sea-qa-ai-chat-ai-model-type-select-editor"
              options={models}
              target={this.optionEditorTarget}
              checkPlacement="right"
              isMultiple={true}
              isSearchEnabled={false}
              value={gettext('Selected_<num>_models').replace('<num>', selectedModels.length.toString())}
              onChange={this.updateFilterModels}
              onToggle={this.closeOptionEditor}
            />
          </div>

          <div className="chart-section">
            {isLoading ? (
              <Loading />
            ) : data && data.length > 0 ? (
              <TokenCostChart
                data={data}
                height={400}
              />
            ) : (
              <EmptyTip text={gettext('No users')} src={`${mediaUrl}img/no-items-tip.png`} />
            )}
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

TokenCostDetailDialog.propTypes = {
  group_by: PropTypes.oneOf(['user', 'project', 'group', 'org']).isRequired,
  condition: PropTypes.string.isRequired,
  onCloseDialog: PropTypes.func.isRequired,
  getModels: PropTypes.func.isRequired,
  getAIStatisticsDetail: PropTypes.func.isRequired
};

export default TokenCostDetailDialog;
