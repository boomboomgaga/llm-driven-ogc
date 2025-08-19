import React from 'react';
import { Chart } from 'react-google-charts';

const SosChart = ({ data, sensorName }) => {
    if (!data || data.length === 0) {
        return null;
    }

    const chartData = [
        ['Time', 'Value'],
        ...data.map(item => [new Date(item.timestamp), item.value])
    ];

    return (
        <div className="sos-results">
            <h4>{sensorName} - Time Series Data</h4>
            <Chart
                chartType="LineChart"
                width="100%"
                height="400px"
                data={chartData}
                options={{
                    legend: { position: 'none' },
                    hAxis: { title: 'Time' },
                    vAxis: { title: 'Value' },
                    pointSize: 5
                }}
            />
        </div>
    );
};

export default SosChart;