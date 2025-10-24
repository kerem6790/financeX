import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CategoryPoint } from './store';
import { formatCurrency } from './store';

const DATE_FORMATTER = new Intl.DateTimeFormat('tr-TR', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

interface CategoryChartProps {
  history: CategoryPoint[];
  color: string;
  label: string;
}

const CategoryChart = ({ history, color, label }: CategoryChartProps) => {
  const data = useMemo(
    () =>
      history.map((point) => ({
        id: point.id,
        label: DATE_FORMATTER.format(new Date(point.capturedAt)),
        timestamp: new Date(point.capturedAt).getTime(),
        value: Number(point.value.toFixed(2))
      })),
    [history]
  );

  const latestValue = useMemo(() => (history.length > 0 ? history[history.length - 1].value : 0), [history]);

  const hasTrend = data.length > 1;

  return (
    <div className="finance-table-chart">
      <div className="finance-table-chart__summary">
        <span className="finance-table-chart__label">{label}</span>
        <span className="finance-table-chart__value">{formatCurrency(latestValue)}</span>
      </div>
      <div className="finance-table-chart__canvas">
        {hasTrend ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 6" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis
                width={96}
                tickMargin={12}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickFormatter={(value) => formatCurrency(value as number).replace('₺', '₺ ')}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), label]}
                labelStyle={{ fontWeight: 600 }}
                contentStyle={{
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 18px 42px rgba(148,163,184,0.25)'
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={3}
                dot={{ r: 3, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: '#0f172a', strokeWidth: 1, fill: color }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="finance-table-chart__placeholder">
            Grafik verisi oluşması için en az iki giriş yapmalısınız.
          </p>
        )}
      </div>
    </div>
  );
};

export default CategoryChart;
