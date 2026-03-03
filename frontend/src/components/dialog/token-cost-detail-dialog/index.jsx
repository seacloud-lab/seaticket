import React, { Component } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import classnames from 'classnames';
import { gettext, mediaUrl } from '@/constants';
import { Loading, EmptyTip, ModalHeader } from '@/components';
import { Utils } from '@/utils/utils';
import toaster from '@/components/toaster';
import DateAndTimePicker from '@/project/main-panel/search/date-and-time-picker';
import CustomizeSelect from '../../customize-select';
import TokenCost from '../../chart/token-cost';

import './index.css';
import '@/sea-metadata/components/popover/filter-popover/basic-filters/index.css';

class TokenCostDetailDialog extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isLoading: true,
      view: 'date',
      startDate: dayjs().subtract(30, 'day'),
      endDate: dayjs(),
      availableModels: [],
      selectedModels: [], // selected models
      fullData: null,
      data: null,
      modelsUsageStatics: null,
      condition: { ...this.props.basicCondition }
    };
  }

  componentDidMount() {
    this.initializeData();
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.basicCondition !== this.props.basicCondition ||
      prevProps.availableViews !== this.props.availableViews
    ) {
      this.initializeData();
    }
  }

  initializeData = () => {
    this.props.getAIStatisticsModels(JSON.stringify(this.props.basicCondition)).then(res => {
      const availableModels = res.data.models;
      this.setState({
        startDate: dayjs().subtract(30, 'day'),
        endDate: dayjs(),
        view: 'date',
        availableModels,
        selectedModels: Object.values(availableModels),
        modelsUsageStatics: null
      }, () => {
        this.fetchStatistics();
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  updateDateData = () => {
    const { fullData, startDate, endDate } = this.state;
    if (!fullData || !fullData.length === 0) {
      this.setState({ data: null, isLoading: false });
      return;
    }

    let newData = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;

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
            name: date.format('YYYY-MM-DD'),
            input_tokens: data.total_input_tokens || 0,
            output_tokens: data.total_output_tokens || 0,
            cost: data.total_cost || 0,
            total_tokens: (data.total_input_tokens || 0) + (data.total_output_tokens || 0)
          });
          totalInputTokens += data.total_input_tokens || 0;
          totalOutputTokens += data.total_output_tokens || 0;
          totalCost += data.total_cost || 0;
        }
      }
    });

    this.setState({ data: newData, modelsUsageStatics: { totalInputTokens, totalOutputTokens, totalCost } });
  };

  updateDataByDate = () => {
    const { view } = this.state;

    this.setState({ isLoading: true }, () => {
      if (view === 'date') {
        this.updateDateData();
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
    });
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
        if (view === 'date') {
          this.updateDateData();
          this.setState({ isLoading: false });
        } else if (!fullData || !fullData.length === 0) {
          this.setState({ data: null, isLoading: false });
        } else {
          let newData = [];
          let totalInputTokens = 0;
          let totalOutputTokens = 0;
          let totalCost = 0;
          fullData.forEach((data) => {
            let record = {
              input_tokens: data.total_input_tokens || 0,
              output_tokens: data.total_output_tokens || 0,
              cost: data.total_cost || 0,
              total_tokens: (data.total_input_tokens || 0) + (data.total_output_tokens || 0)
            };
            if (view === 'user') {
              record.name = data.user;
            } else if (view === 'project') {
              record.name = data.project;
            }
            newData.push(record);
            totalInputTokens += data.total_input_tokens || 0;
            totalOutputTokens += data.total_output_tokens || 0;
            totalCost += data.total_cost || 0;
          });
          this.setState({ data: newData, modelsUsageStatics: { totalInputTokens, totalOutputTokens, totalCost }, isLoading: false });
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

  updateFilterModels = (newValue) => {
    let newSelectedModels = this.state.selectedModels.slice(0);
    if (newSelectedModels.includes(newValue)) {
      newSelectedModels = newSelectedModels.filter(v => v !== newValue);
    } else {
      newSelectedModels = [...newSelectedModels, newValue];
    }
    this.setState({ selectedModels: newSelectedModels }, () => {
      this.fetchStatistics();
    });
  };

  updateView = (newView) => {
    let newCondition = this.props.basicCondition;
    if (newView !== 'date') {
      newCondition.start_date = this.state.startDate;
      newCondition.end_date = this.state.endDate;
    }
    this.setState({ view: newView, condition: newCondition }, () => {
      this.fetchStatistics();
    });
  };

  render() {
    const {
      isLoading,
      startDate,
      endDate,
      availableModels,
      selectedModels,
      data,
      view,
      modelsUsageStatics
    } = this.state;
    const { views, onCloseDialog } = this.props;

    const modelsOptions = availableModels && typeof availableModels === 'object' ? Object.entries(availableModels).map(([label, value]) => {
      return {
        value: value,
        label: (
          <div className="select-basic-filter-option">
            <div className="select-basic-filter-option-checkbox mr-2">
              <input type="checkbox" checked={selectedModels.includes(value)} readOnly />
            </div>
            <div className="select-basic-filter-option-name" title={label} aria-label={label}>{label}</div>
          </div>
        )
      };
    }) : [];

    const customizeSelectClassName = 'sea-metadata-basic-filters-select sea-metadata-table-view-basic-checkbox-select sea-ticket-ai-statistic-condition-select';

    return (
      <Modal isOpen={true} toggle={onCloseDialog} autoFocus={false} className="ai-statistics-dialog">
        <ModalHeader toggle={onCloseDialog}>{gettext('Token cost statistics detail')}</ModalHeader>
        <ModalBody className="dialog-content">
          <div className="ai-statistics-filters">
            {views.length > 1 && (
              <CustomizeSelect
                disabled={false}
                supportMultipleSelect={false}
                className={classnames(customizeSelectClassName, 'mr-4 highlighted')}
                value={views.find(v => v.value === view) || views[0]}
                options={views}
                onChange={this.updateView}
              />
            )}
            <CustomizeSelect
              disabled={false}
              supportMultipleSelect={true}
              className={classnames(customizeSelectClassName, 'mr-4', { 'highlighted': selectedModels.length > 0 })}
              value={{ label: `${gettext('Model')} (${selectedModels.length} ${gettext('selected')})` }}
              options={modelsOptions}
              onChange={this.updateFilterModels}
            />
            <div className="sea-ticket-ai-statistic-date-condition">
              <span className="date-range-title">{gettext('Date range: ')}</span>
              <span className="date-range-value">
                <DateAndTimePicker
                  showHourAndMinute={false}
                  disabledDate={(date) => date > new Date(endDate)}
                  value={startDate}
                  onChange={(date) => this.onDateChange(date, 'start')}
                  inputWidth={92}
                />
              </span>
              <span className="date-range-">{'-'}</span>
              <span className="date-range-value">
                <DateAndTimePicker
                  showHourAndMinute={false}
                  disabledDate={(date) => date < new Date(startDate) || date > dayjs()}
                  value={endDate}
                  onChange={(date) => this.onDateChange(date, 'end')}
                  inputWidth={92}
                />
              </span>
            </div>
          </div>
          <div className="w-100" style={{ height: 'calc(100% - 44px)' }}>
            {isLoading ? (
              <Loading />
            ) : selectedModels.length > 0 && data && data.length > 0 ? (
              <TokenCost
                data={data}
                modelsUsageStatics={modelsUsageStatics}
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
  views: PropTypes.array.isRequired,
  onCloseDialog: PropTypes.func.isRequired,
  getAIStatisticsModels: PropTypes.func.isRequired,
  getAIStatisticsDetail: PropTypes.func.isRequired,
  basicCondition: PropTypes.object.isRequired
};

export default TokenCostDetailDialog;
