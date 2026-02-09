import React, { Component } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { gettext, mediaUrl } from '@/constants';
import { Loading, EmptyTip, TokenCostChart, ModalHeader } from '@/components';
import { Utils } from '@/utils/utils';
import toaster from '@/components/toaster';
import { Modal, ModalBody, Label } from 'reactstrap';
import DateAndTimePicker from '@/project/main-panel/search/date-and-time-picker';
import Select from 'react-select';

import './index.css';

class TokenCostDetailDialog extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isLoading: true,
      view: 'daily',
      startDate: dayjs().subtract(30, 'day'),
      endDate: dayjs(),
      selectedModels: [], // selected models
      fullData: null,
      data: null,
      condition: { ...this.props.basicCondition }
    };

  }

  componentDidMount() {
    this.initializeData();
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.basicCondition !== this.props.basicCondition ||
      prevProps.availableViews !== this.props.availableViews ||
      prevProps.models !== this.props.models
    ) {
      this.initializeData();
    }
  }

  initializeData = () => {
    this.setState({ startDate: dayjs().subtract(30, 'day'), endDate: dayjs(), view: 'daily', selectedModels: this.props.models }, () => {
      this.fetchStatistics();
    });
  };

  updateDailyData = () => {
    const { fullData, startDate, endDate } = this.state;
    if (!fullData || !fullData.length === 0) {
      this.setState({ data: null, isLoading: false });
      return;
    }

    let newData = [];

    const dateSorted = fullData.sort((a, b) => {
      const dateA = dayjs(a.date).valueOf();
      const dateB = dayjs(b.date).valueOf();
      return dateA - dateB;
    });

    dateSorted.forEach((data) => {
      if (data.date) {
        const date = dayjs(data.date);
        if (date >= startDate && date <= endDate) {
          newData.push({
            date: data.date,
            input_tokens: data.total_input_tokens || 0,
            output_tokens: data.total_output_tokens || 0,
            cost: data.total_cost || 0,
            total_tokens: (data.total_input_tokens || 0) + (data.total_output_tokens || 0)
          });
        }
      }
    });

    this.setState({ data: newData });
  };

  updateDataByDate = () => {
    const { view } = this.state;

    this.setState({ isLoading: true });
    if (view === 'daily') {
      this.updateDailyData();
    } else {
      let condition = { ...this.props.basicCondition };
      const { startDate, endDate } = this.state;
      condition.start_date = startDate;
      condition.end_date = endDate;
      this.setState({ condition }, () => {
        this.fetchStatistics();
      });
    }
    this.setState({ isLoading: false });
  };

  fetchStatistics = () => {
    this.setState({ isLoading: true });
    const { view, selectedModels, condition } = this.state;

    if (!selectedModels || selectedModels.length === 0) {
      this.setState({ fullData: null, date: null, isLoading: false });
      return;
    }

    this.props.getAIStatisticsDetail(view, JSON.stringify(selectedModels), JSON.stringify(condition)).then(res => {
      const fullData = res.data.results;
      this.setState({ fullData: fullData || null }, () => {
        if (view === 'daily') {
          this.updateDailyData();
          this.setState({ isLoading: false });
        } else if (!fullData || !fullData.length === 0) {
          this.setState({ data: null, isLoading: false });
        } else {
          let newData = [];
          fullData.forEach((data) => {
            let record = {
              input_tokens: data.total_input_tokens || 0,
              output_tokens: data.total_output_tokens || 0,
              cost: data.total_cost || 0,
              total_tokens: (data.total_input_tokens || 0) + (data.total_output_tokens || 0)
            };
            if (view === 'user') {
              record.user = data.user;
            } else if (view === 'project') {
              record.project = data.project;
            }
            newData.push(record);
          });
          this.setState({ data: newData, isLoading: false });
        }
      });
    }).catch (error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
      this.setState({ isLoading: false });
    });
  };

  onDateChange = (date, type) => {
    if (date && date.isValid()) {
      if (type === 'start') {
        this.setState({ startDate: date }, () => {
        });
      } else if (type === 'end') {
        this.setState({ endDate: date }, () => {
        });
      }
      this.updateDataByDate();
    }
  };

  updateFilterModels = (selectedModels) => {
    let newSelectedModels = [];
    selectedModels.forEach((item) => {
      newSelectedModels.push(item.value);
    });
    this.setState({ selectedModels: newSelectedModels }, () => {
      this.fetchStatistics();
    });
  };

  updateView = (view) => {
    let newView = view.value;
    let newCondition = this.props.basicCondition;
    if (view !== 'daily') {
      newCondition.start_date = this.state.startDate;
      newCondition.end_date = this.state.endDate;
    }
    this.setState({ view: newView, condition: newCondition }, () => {
      this.fetchStatistics();
    });
  };

  arrayToSelectComponentsObject = (arrayObject) => {
    let newObject = [];
    arrayObject.forEach((item) => {
      newObject.push({ value: item, label: item });
    });
    return newObject;
  };

  render() {
    const {
      isLoading,
      startDate,
      endDate,
      selectedModels,
      data,
    } = this.state;
    const { models, view, availableViews, onCloseDialog } = this.props;

    return (
      <Modal isOpen={true} toggle={onCloseDialog} autoFocus={false} className="ai-statistics-dialog">
        <ModalHeader toggle={onCloseDialog}>{gettext('Token cost statistics detail')}</ModalHeader>
        <ModalBody className="dialog-content">
          <div className="filters-section">
            <div className="filter-row">
              <div className="filter-item">
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
          {availableViews.length > 1 && (
            <div className="view-section">
              <Select
                value={{ value: view, label: view }}
                onChange={this.updateView}
                options={this.arrayToSelectComponentsObject(availableViews)}
                placeholder={gettext('View')}
                isSearchable={true}
              />
            </div>
          )}
          <div className="models-section">
            <Select
              value={this.arrayToSelectComponentsObject(selectedModels)}
              onChange={this.updateFilterModels}
              options={this.arrayToSelectComponentsObject(models)}
              placeholder={gettext('Filter_models')}
              closeMenuOnSelect={false}
              isSearchable={true}
              isMulti={true}
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
              <EmptyTip text={gettext('Empty')} src={`${mediaUrl}img/no-items-tip.png`} />
            )}
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

TokenCostDetailDialog.propTypes = {
  availableViews: PropTypes.array.isRequired,
  onCloseDialog: PropTypes.func.isRequired,
  models: PropTypes.array.isRequired,
  getAIStatisticsDetail: PropTypes.func.isRequired,
  basicCondition: PropTypes.object.isRequired
};

export default TokenCostDetailDialog;
