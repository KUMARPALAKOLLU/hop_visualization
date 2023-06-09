import React, { useState, useEffect } from 'react';
import useWebSocket from 'react-use-websocket';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

const webSocketOptions = {
  shouldReconnect: (closeEvent: CloseEvent) => closeEvent.code !== 1000, // Don't reconnect on normal closure
};

function App() {
  const [input, setInput] = useState('');
  const [socketUrl, setSocketUrl] = React.useState<string | null>(null);
  const [messageHistory, setMessageHistory] = React.useState<any[]>([]);
  const [tracerouteStatus, setTracerouteStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [graphURL, setGraphURL] = useState<string | null>(null);
  const [mapURL, setMapURL] = useState<string | null>(null);
  const [visualizationType, setVisualizationType] = useState('');

  const handleVisualizationChange = (event) => {
    setVisualizationType(event.target.value);
  };

  const { sendMessage, lastMessage, readyState } = useWebSocket(socketUrl, webSocketOptions);

  useEffect(() => {
    if (lastMessage) {
      console.log('Received message: ', lastMessage.data);
      const jsonData = JSON.parse(lastMessage.data); // parse the data into JSON
      // Check if it's an error message
      if (jsonData.status === "error") {
        setErrorMessage(jsonData.message);
        setTracerouteStatus('Traceroute Finished');
      } else {
        setMessageHistory((prev) => [...prev, jsonData]);
      }
    }
  }, [lastMessage]);

  useEffect(() => {
    if (readyState === 1) {
      console.log('Connection opened', readyState);
      setTracerouteStatus('Running Traceroute...');
      if (input !== '') {
        setMapURL(null);
        setGraphURL(null);
        sendMessage(JSON.stringify({ hostname: input, selected: visualizationType }));
      }
    } else if (readyState === 3) {
      console.log('Connection closed');
      setTracerouteStatus('Traceroute Finished');

      if (!errorMessage) {
        if (visualizationType === 'googleMaps') {
          setMapURL('http://127.0.0.1:8000/getmap/');
        } else if (visualizationType === 'graph') {
          setGraphURL('http://127.0.0.1:8000/getgraph/');
        } else {
          setMapURL('http://127.0.0.1:8000/getmap/');
          setGraphURL('http://127.0.0.1:8000/getgraph/');
        }
      }
    }
  }, [readyState, errorMessage, visualizationType]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value);
  };

  const handleRunClick = (event: React.FormEvent) => {
    event.preventDefault();
    // Disconnect the existing WebSocket, if any
    setSocketUrl(null);

    // Clear the old traceroute results
    setMessageHistory([]);

    // Clear the old error message
    setErrorMessage('');

    // Use a timeout to allow state updates to propagate
    setTimeout(() => {
      // Start a new WebSocket connection
      setSocketUrl('ws://127.0.0.1:8000/ws/traceroute/');
    }, 100);
  };

  return (
    <div><div id="root" className="d-flex flex-column align-items-center justify-content-center">
      <div className="page">
        <h1>Traceroute Visualization</h1>
        <form onSubmit={handleRunClick} className="d-flex justify-content-center mt-5" style={{ gap: '0.5rem', width: '100%' }}>
          <div className="container">
            <input
              type="text"
              className="form-control"
              style={{ width: '100%' }}
              placeholder="Enter hostname"
              value={input}
              onChange={handleChange}
            />
            <br />
            <select
              className="form-control mb-3"
              style={{ width: '100%' }}
              value={visualizationType}
              onChange={handleVisualizationChange}
              disabled={input === ''}
            >
              <option value="">Select visualization type</option>
              <option value="googleMaps">Google Maps</option>
              <option value="graph">Graph</option>
              <option value="both">Both</option>
            </select>
            <br />
            <button type="submit" className="btn run-btn" disabled={input === '' || visualizationType === ''}>
              Visualize
            </button>
          </div>
        </form>
        {(!(input === '') && (!input.includes('.') || input.split('.').pop().length < 2)) && (
        <h2>Please Enter a Valid Hostname</h2>
      )}
      </div>
      <div className="mt-2">
        <p className="text-secondary" style={{ textAlign: 'center' }}></p>
      </div>
      <div className="mt-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0)' }}>
        <h4 className={tracerouteStatus === 'Running Traceroute...' ? "text-warning" : "text-success"}>{tracerouteStatus}</h4>
        {errorMessage ? (
          <div className="alert alert-danger" role="alert">
            {errorMessage}
          </div>
        ) : messageHistory.length > 0 && (
          <table className="table table-bordered mt-4" style={{ color: "black", borderColor: "black" }}>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">IP</th>
                <th scope="col">Latitude</th>
                <th scope="col">Longitude</th>
                <th scope="col">City</th>
                <th scope="col">State</th>
                <th scope="col">Country</th>
              </tr>
            </thead>
            <tbody>
              {messageHistory.map((message, idx) => (
                <tr key={idx}>
                  <th scope="row">{idx + 1}</th>
                  <td className={message.ip ? '' : 'text-secondary'}>{message.ip || 'Private'}</td>
                  <td className={(message.latitude !== null && message.longitude !== null && message.latitude !== 0) ? '' : 'text-secondary'}>
                    {(message.latitude !== null && message.longitude !== null && message.latitude !== 0) ? message.latitude : 'Private'}
                  </td>
                  <td className={(message.latitude !== null && message.longitude !== null && message.longitude !== 0) ? '' : 'text-secondary'}>
                    {(message.latitude !== null && message.longitude !== null && message.longitude !== 0) ? message.longitude : 'Private'}
                  </td>
                  <td className={message.city ? '' : 'text-secondary'}>{message.city || 'Private'}</td>
                  <td className={message.state ? '' : 'text-secondary'}>{message.state || 'Private'}</td>
                  <td className={message.country ? '' : 'text-secondary'}>
                    {message.country || 'Private'}
                    {message.country_flag && <img src={message.country_flag} alt={message.country} style={{ width: '25px', marginLeft: '10px' }} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
    <div>
      {mapURL && <h4 className='mb-3 mt-5'>Map Visualization</h4>}
      {mapURL && <iframe src={mapURL} title="Map" style={{ width: '100%', height: '50rem' }} />}
      {graphURL && <h4 className='mb-3 mt-5'>Graph Visualization</h4>}
      {graphURL && <iframe src={graphURL} title="Graph" style={{ width: '100%', height: '50rem' }} />}
    </div> </div>
  );
}

export default App;
