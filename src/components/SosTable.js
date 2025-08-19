import React from 'react';

const SosTable = ({ data }) => {
    if (!data || data.length === 0) {
        return <p>No observation data available for this period.</p>;
    }

    return (
        <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th style={{border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2'}}>Timestamp</th>
                        <th style={{border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2'}}>Value</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((item, index) => (
                        <tr key={index}>
                            <td style={{border: '1px solid #ddd', padding: '8px'}}>{new Date(item.timestamp).toLocaleString()}</td>
                            <td style={{border: '1px solid #ddd', padding: '8px'}}>{item.value}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default SosTable;