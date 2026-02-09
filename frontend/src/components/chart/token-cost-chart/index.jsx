import React, { useMemo } from 'react';
import { gettext } from '@/constants';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';


import './index.css';

const TokenCostChart = ({
  data,
  colors = {
    inputTokens: '#8884d8',
    outputTokens: '#82ca9d',
    costLine: '#ff7300'
  },
  height = 500
}) => {
  const getXDataKey = () => {
    if (data.length === 0) return 'date';

    const firstItem = data[0];
    if (firstItem.date) return 'date';
    if (firstItem.user) return 'user';
    if (firstItem.project) return 'project';
    return 'date';
  };

  const getXAxisLabel = () => {
    const xDataKey = getXDataKey();
    switch (xDataKey) {
      case 'user': return 'User';
      case 'project': return 'Project';
      default: return 'Date';
    }
  };

  const xDataKey = getXDataKey();
  const xAxisLabel = getXAxisLabel();

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = data.find(item => {
        return item[xDataKey] === label;
      });
      return (
        <div className='custom-tooltip'>
          <p className='tooltip-label'>
            {label}
          </p>
          {payload.map((entry, index) => {
            if (entry.dataKey === 'input_tokens' || entry.dataKey === 'output_tokens') {
              const isInput = entry.dataKey === 'input_tokens';
              const color = isInput ? colors.inputTokens : colors.outputTokens;
              return (
                <p key={`${entry.dataKey}-${index}`} className='tooltip-item'>
                  <span
                    className='color-indicator'
                    style={{ backgroundColor: color }}
                  />
                  {`${isInput ? gettext('Input tokens') : gettext('Output tokens')}: ${entry.value}`}
                </p>
              );
            }
            if (entry.dataKey === 'cost') {
              return (
                <p key='cost' className='tooltip-item'>
                  <span
                    className='color-indicator circle'
                    style={{ backgroundColor: colors.costLine }}
                  />
                  {`${gettext('Cost')}: ${entry.value}`}
                </p>
              );
            }
            return null;
          })}
          {dataPoint && (
            <p className='tooltip-total'>
              {gettext('Total tokens')}: {dataPoint.total_tokens}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const getMaxBarValue = useMemo(() => {
    if (!data.length) return 100;
    const maxTotal = Math.max(...data.map(item => item.total_tokens));
    return Math.ceil(maxTotal * 1.1);
  }, [data]);

  const getMaxCostValue = useMemo(() => {
    if (!data.length) return 10;
    const maxCost = Math.max(...data.map(item => item.cost));
    return maxCost * 1.2;
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className='chart-wrapper'>
        <div className='chart-container' style={{ height: `${height}px` }}>
          <div className='no-data'>
            {gettext('No data available')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='chart-wrapper'>
      <div className='chart-container' style={{ height: `${height}px` }}>
        <ResponsiveContainer width='100%' height='100%'>
          <ComposedChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
            <XAxis
              dataKey={xDataKey}
              label={{
                value: gettext(xAxisLabel),
                position: 'insideBottom',
                offset: -10,
                style: { fontSize: '12px' }
              }}
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: '#d9d9d9' }}
            />
            <YAxis
              yAxisId='left'
              label={{
                value: gettext('Token usage'),
                angle: -90,
                position: 'insideLeft',
                offset: -10,
                style: { fontSize: '12px' }
              }}
              domain={[0, getMaxBarValue]}
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: '#d9d9d9' }}
            />
            <YAxis
              yAxisId='right'
              orientation='right'
              label={{
                value: gettext('Cost'),
                angle: 90,
                position: 'insideRight',
                offset: -10,
                style: { fontSize: '12px' }
              }}
              domain={[0, getMaxCostValue]}
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: '#d9d9d9' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{
                paddingTop: '10px',
                fontSize: '12px'
              }}
            />

            <Bar
              yAxisId='left'
              dataKey='input_tokens'
              name={gettext('Input Tokens')}
              stackId='a'
              fill={colors.inputTokens}
              radius={[2, 2, 0, 0]}
            >
              {data.map((entry, index) => (
                <Cell key={`input-cell-${index}`} fill={colors.inputTokens} />
              ))}
            </Bar>

            <Bar
              yAxisId='left'
              dataKey='output_tokens'
              name={gettext('Output tokens')}
              stackId='a'
              fill={colors.outputTokens}
              radius={[2, 2, 0, 0]}
            >
              {data.map((entry, index) => (
                <Cell key={`output-cell-${index}`} fill={colors.outputTokens} />
              ))}
            </Bar>

            <Line
              yAxisId='right'
              type='monotone'
              dataKey='cost'
              name={gettext('Cost')}
              stroke={colors.costLine}
              strokeWidth={2}
              dot={{
                r: 4,
                stroke: colors.costLine,
                strokeWidth: 2,
                fill: 'white'
              }}
              activeDot={{
                r: 6,
                stroke: colors.costLine,
                strokeWidth: 2,
                fill: 'white'
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
};

TokenCostChart.defaultProps = {
  data: [],
  colors: {
    inputTokens: '#8884d8',
    outputTokens: '#82ca9d',
    costLine: '#ff7300'
  },
  height: 500
};

export default TokenCostChart;
