import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

export interface ResultDonutSlice {
  name: string;
  value: number;
}

interface ResultDonutChartProps {
  data: ResultDonutSlice[];
  colors: string[];
  primaryColor: string;
  innerRadius: number;
  outerRadius: number;
  cellKeyPrefix: string;
}

export const ResultDonutChart: React.FC<ResultDonutChartProps> = ({
  data,
  colors,
  primaryColor,
  innerRadius,
  outerRadius,
  cellKeyPrefix,
}) => (
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie
        data={data}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        paddingAngle={0}
        dataKey="value"
        startAngle={90}
        endAngle={-270}
      >
        {data.map((entry, index) => (
          <Cell key={`${cellKeyPrefix}-${index}-${entry.name}`} fill={index === 0 ? primaryColor : colors[index % colors.length]} />
        ))}
      </Pie>
    </PieChart>
  </ResponsiveContainer>
);
