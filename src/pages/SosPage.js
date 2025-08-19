import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SosChart from '../components/SosChart';
import SosTable from '../components/SosTable';

const SosPage = ({ setMapLayers, setViewState }) => {
    const [serverUrl, setServerUrl] = useState('http://localhost/istsos/istsos');
    const [sensorList, setSensorList] = useState([]);
    const [filteredSensors, setFilteredSensors] = useState([]);
    const [observationData, setObservationData] = useState([]);
    const [selectedSensor, setSelectedSensor] = useState(null);
    const [formData, setFormData] = useState({
        bbox: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setFilteredSensors(sensorList);
    }, [sensorList]);

    const handleGetCapabilities = async () => {
        setLoading(true);
        setError('');
        
        const getCapsUrl = `${serverUrl}?service=SOS&request=GetCapabilities`;

        try {
            // UPDATED: Route GetCapabilities through the proxy
            const proxyCapsUrl = `http://localhost:3001/proxy?url=${encodeURIComponent(getCapsUrl)}`;
            const res = await axios.get(proxyCapsUrl);
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(res.data, "text/xml");

            const procedures = Array.from(xmlDoc.getElementsByTagName('sos:procedure'));
            const procedureIds = procedures.map(p => p.getAttribute('xlink:href'));
            
            const sensorDetailsPromises = procedureIds.map(async (id) => {
                if (!id) return null;
                const describeSensorUrl = `${serverUrl}?service=SOS&version=1.0.0&request=DescribeSensor&procedure=${id}&outputFormat=text/xml;subtype="sensorML/1.0.1"`;
                
                // UPDATED: Route each DescribeSensor call through the proxy
                const proxyDescribeUrl = `http://localhost:3001/proxy?url=${encodeURIComponent(describeSensorUrl)}`;
                const sensorRes = await axios.get(proxyDescribeUrl);
                const sensorXml = parser.parseFromString(sensorRes.data, "text/xml");
                const coordsText = sensorXml.querySelector('gml\\:coordinates')?.textContent;
                
                if (!coordsText) return null;
                
                const [lon, lat] = coordsText.split(',').map(parseFloat);
                return {
                    id,
                    name: id.split(':').pop(),
                    coords: [lon, lat],
                    observedProperty: sensorXml.querySelector('swe\\:Quantity')?.getAttribute('definition') || 'Unknown'
                };
            });
            
            const detailedSensors = (await Promise.all(sensorDetailsPromises)).filter(Boolean);
            setSensorList(detailedSensors);

            const sensorFeatures = detailedSensors.map(s => new window.ol.Feature({
                geometry: new window.ol.geom.Point(window.ol.proj.fromLonLat(s.coords))
            }));
            const vectorSource = new window.ol.source.Vector({ features: sensorFeatures });
            const vectorLayer = new window.ol.layer.Vector({ source: vectorSource });
            setMapLayers([vectorLayer]);
            if (sensorFeatures.length > 0) {
                 setViewState({ extent: vectorSource.getExtent() });
            }
        } catch (err) {
            setError('Failed to fetch SOS capabilities. Is the proxy server running?');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleFilter = () => {
        if (!formData.bbox) {
            setFilteredSensors(sensorList);
            return;
        }
        const [minX, minY, maxX, maxY] = formData.bbox.split(',').map(parseFloat);
        if ([minX, minY, maxX, maxY].some(isNaN)) {
            setError('Invalid BBOX format. Use minX,minY,maxX,maxY');
            return;
        }
        const filtered = sensorList.filter(s => 
            s.coords[0] >= minX && s.coords[0] <= maxX &&
            s.coords[1] >= minY && s.coords[1] <= maxY
        );
        setFilteredSensors(filtered);
    };
    
    const handleGetObservation = async () => {
        if (!selectedSensor) {
            setError('Please select a sensor.');
            return;
        }
        const { startDate, startTime, endDate, endTime } = formData;
        if (!startDate || !startTime || !endDate || !endTime) {
            setError('Please specify a complete time window.');
            return;
        }
        const eventTime = `${startDate}T${startTime}Z/${endDate}T${endTime}Z`;
        
        const finalUrl = `${serverUrl}?service=SOS&version=1.0.0&request=GetObservation&offering=temporary&procedure=${selectedSensor.id}&observedProperty=${selectedSensor.observedProperty}&responseFormat=text/xml&eventTime=${eventTime}`;

        try {
            // UPDATED: Route GetObservation through the proxy
            const proxyObservationUrl = `http://localhost:3001/proxy?url=${encodeURIComponent(finalUrl)}`;
            const res = await axios.get(proxyObservationUrl);
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(res.data, "text/xml");
            const valuesText = xmlDoc.querySelector('swe\\:values')?.textContent.trim();
            
            if (!valuesText) {
                setObservationData([]);
                return;
            }
            const readings = valuesText.split(' ').map(pair => {
                const [timestamp, value] = pair.split(',');
                if (!timestamp || !value) return null;
                return { timestamp, value: parseFloat(value) };
            }).filter(Boolean);
            
            setObservationData(readings);
        } catch (err) {
            setError('Failed to fetch observations. Is the proxy server running?');
            console.error(err);
        }
    };

    const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    // ... your JSX return statement remains exactly the same ...
    return (
        <div className="form-container">
            <h3>SOS Client</h3>
            <label>Server URL</label>
            <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
            <button onClick={handleGetCapabilities} disabled={loading}>{loading ? 'Loading...' : 'Get Capabilities'}</button>
            {error && <p style={{color: 'red'}}>{error}</p>}
            
            <label>Filter by Bounding Box (minX,minY,maxX,maxY)</label>
            <input name="bbox" value={formData.bbox} onChange={handleChange} placeholder="e.g. -10,40,0,50"/>
            <button onClick={handleFilter}>Filter Sensors</button>

            <label>Sensor</label>
            <select onChange={(e) => setSelectedSensor(e.target.value ? JSON.parse(e.target.value) : null)}>
                <option value="">Select a Sensor</option>
                {filteredSensors.map(s => <option key={s.id} value={JSON.stringify(s)}>{s.name}</option>)}
            </select>
            
            <label>Time Window</label>
            <div className="bbox-group">
                <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} />
                <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} />
                <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} />
                <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} />
            </div>
            
            <button onClick={handleGetObservation}>Get Observation</button>

            {observationData.length > 0 && selectedSensor && (
                <>
                    <SosChart data={observationData} sensorName={selectedSensor.name} />
                    <SosTable data={observationData} />
                </>
            )}
        </div>
    );
};

export default SosPage;