import React, { Component } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import classnames from 'classnames';
import dayjs from 'dayjs';
import PropTypes from 'prop-types';
import { DatePicker, Loading, EmptyTip, ModalHeader } from '@/components';
import toaster from '@/components/toaster';
import { gettext, mediaUrl } from '@/constants';
import { Utils } from '@/utils/utils';
import TokenCreditUsed from '../../chart/token-credit-used';
import CustomizeSelect from '../../customize-select';

import './index.css';
import '@/sea-metadata/components/popover/filter-popover/basic-filters/index.css';

const ALL_SCENARIOS = [
  { value: 'summary', label: 'Summary' },
  { value: 'agent', label: 'Agent' },
  { value: 'chat', label: 'Chat' },
  { value: 'portal-chat', label: 'Portal Chat' },
  { value: 'search', label: 'Search' },
  { value: 'record-generation', label: 'Record generation' },
];

class TokenCreditUsedDetailDialog extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isLoading: true,
      groupBy: 'date',
      startDate: dayjs().subtract(30, 'day'),
      endDate: dayjs(),
      availableModels: {},
      selectedModels: [], // selected models
      selectedScenarios: ALL_SCENARIOS.map(s => s.value),
      fullData: null,
      data: null,
      modelsUsageStatics: null,
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
    this.setState({
      startDate: dayjs().subtract(30, 'day'),
      endDate: dayjs(),
      groupBy: 'date',
      availableModels: {},
      selectedModels: [],
      selectedScenarios: ALL_SCENARIOS.map(s => s.value),
      modelsUsageStatics: null
    }, () => {
      this.fetchStatistics();
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
    let totalCreditUsed = 0;

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
            credit_used: data.total_credit_used || 0,
            total_tokens: (data.total_input_tokens || 0) + (data.total_output_tokens || 0)
          });
          totalInputTokens += data.total_input_tokens || 0;
          totalOutputTokens += data.total_output_tokens || 0;
          totalCreditUsed += data.total_credit_used || 0;
        }
      }
    });

    this.setState({ data: newData, modelsUsageStatics: { totalInputTokens, totalOutputTokens, totalCreditUsed } });
  };

  updateDataByDate = () => {
    const { groupBy } = this.state;

    this.setState({ isLoading: true }, () => {
      if (groupBy === 'date') {
        this.updateDateData();
      } else {
        this.fetchStatistics();
      }
      this.setState({ isLoading: false });
    });
  };

  fetchStatistics = () => {
    this.setState({ isLoading: true });
    const { condition } = this.props;
    const { groupBy, startDate, endDate, selectedScenarios } = this.state;
    const allValues = ALL_SCENARIOS.map(s => s.value);
    const scenariosParam = selectedScenarios.length === allValues.length ? undefined : selectedScenarios;

    this.props.getAIStatisticsDetail(groupBy, startDate, endDate, JSON.stringify(condition), scenariosParam).then(res => {
      const fullData = res.data.results;
      this.setState({ fullData: fullData || null }, () => {
        if (groupBy === 'date') {
          this.updateDateData();
          this.setState({ isLoading: false });
        } else if (!fullData || !fullData.length === 0) {
          this.setState({ data: null, isLoading: false });
        } else {
          let newData = [];
          let totalInputTokens = 0;
          let totalOutputTokens = 0;
          let totalCreditUsed = 0;
          fullData.forEach((data) => {
            let record = {
              input_tokens: data.total_input_tokens || 0,
              output_tokens: data.total_output_tokens || 0,
              credit_used: data.total_credit_used || 0,
              total_tokens: (data.total_input_tokens || 0) + (data.total_output_tokens || 0)
            };
            if (groupBy === 'user') {
              record.name = data.user;
            } else if (groupBy === 'project') {
              record.name = data.project;
            }
            newData.push(record);
            totalInputTokens += data.total_input_tokens || 0;
            totalOutputTokens += data.total_output_tokens || 0;
            totalCreditUsed += data.total_credit_used || 0;
          });
          this.setState({ data: newData, modelsUsageStatics: { totalInputTokens, totalOutputTokens, totalCreditUsed }, isLoading: false });
        }
      });
    }).catch(error => {
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

  updateFilterScenarios = (newValue) => {
    let newSelected = this.state.selectedScenarios.slice(0);
    if (newSelected.includes(newValue)) {
      if (newSelected.length === 1) return;
      newSelected = newSelected.filter(v => v !== newValue);
    } else {
      newSelected = [...newSelected, newValue];
    }
    this.setState({ selectedScenarios: newSelected }, () => {
      this.fetchStatistics();
    });
  };

  updateView = (newView) => {
    this.setState({ groupBy: newView }, () => {
      this.fetchStatistics();
    });
  };

  render() {
    const {
      isLoading,
      startDate,
      endDate,
      selectedScenarios,
      data,
      groupBy,
      modelsUsageStatics
    } = this.state;
    const { groups, onCloseDialog } = this.props;

    const customizeSelectClassName = 'sea-metadata-table-group-by-basic-checkbox-select seaqa-ai-statistic-condition-select';

    return (
      <Modal isOpen={true} toggle={onCloseDialog} autoFocus={false} className="ai-statistics-dialog">
        <ModalHeader toggle={onCloseDialog}>{gettext('Credit used detail')}</ModalHeader>
        <ModalBody className="dialog-content">
          <div className="ai-statistics-filters">
            {groups.length > 1 && (
              <CustomizeSelect
                disabled={false}
                supportMultipleSelect={false}
                className={classnames(customizeSelectClassName, 'mr-4')}
                hasBorder={false}
                options={groups}
                value={groupBy}
                onChange={this.updateView}
              >
                {gettext('Group by')}
              </CustomizeSelect>
            )}
            <CustomizeSelect
              disabled={false}
              supportMultipleSelect={true}
              className={classnames(customizeSelectClassName, 'mr-4')}
              highlight={selectedScenarios.length < ALL_SCENARIOS.length}
              hasBorder={false}
              value={selectedScenarios}
              options={ALL_SCENARIOS}
              onChange={this.updateFilterScenarios}
            >
              {`${gettext('Scenario')} (${selectedScenarios.length}/${ALL_SCENARIOS.length})`}
            </CustomizeSelect>
            <div className="seaqa-ai-statistic-date-condition">
              <span className="date-range-title">{gettext('Date range: ')}</span>
              <span className="date-range-value">
                <DatePicker
                  disabledDate={(date) => date > new Date(endDate) || date < dayjs().subtract(90, 'day')}
                  value={startDate}
                  onChange={(date) => this.onDateChange(date, 'start')}
                  inputWidth={92}
                />
              </span>
              <span className="date-range-">{'-'}</span>
              <span className="date-range-value">
                <DatePicker
                  disabledDate={(date) => date < new Date(startDate) || date > dayjs()}
                  value={endDate}
                  onChange={(date) => this.onDateChange(date, 'end')}
                  inputWidth={92}
                />
              </span>
            </div>
          </div>
          <div className="ai-statistics-content w-100">
            {isLoading ? (
              <Loading />
            ) : data && data.length > 0 ? (
              <TokenCreditUsed
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

TokenCreditUsedDetailDialog.propTypes = {
  groups: PropTypes.array.isRequired,
  onCloseDialog: PropTypes.func.isRequired,
  getAIStatisticsDetail: PropTypes.func.isRequired,
  condition: PropTypes.object.isRequired
};

export default TokenCreditUsedDetailDialog;
