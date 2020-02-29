import React, {Component} from 'react';
import {Map, TileLayer, PolyLine} from 'react-leaflet';
import {} from 'leaflet';
import CanvasDrawing from './CanvasDrawing';

// The map-drawing-canvas thing
const MAP_URL_TERRAIN = "https://api.mapbox.com/styles/v1/mwsundberg/ck26wfu0759jk1claf7a3bblm/tiles/{z}/{x}/{y}?access_token={accessToken}";
const MAP_URL_RGB_ELEVATION = "https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token={accessToken}";
const MAP_ACCESS_TOKEN = "pk.eyJ1IjoibXdzdW5kYmVyZyIsImEiOiJjazI4Z3lkcHkwb3pzM2RwYm44YW9nM2ZuIn0.EyqGj9GuiUpvoauajxVPgA";
class MapDrawingArea extends Component {
	constructor(props) {
		super(props);

		this.state = {
			painting: this.props.painting,
			lines: this.props.lines,
			width: 100,
			height: 100
		}

		// Bind listeners
		this.onMapMovement = this.onMapMovement.bind(this);
		this.onLineDrawn = this.onLineDrawn.bind(this);
	}

	// Handle mounting and unmounting (canvas click listeners?)
	componentDidMount() {
		console.log("Mounted MapDrawingArea");

		// With the div sized up now, set the width and height properties on a listener
		window.addEventListener("resize", this.onResizeRescaleCanvas);
	}

	componentWillUnmount() {
		console.log("Unmounting MapDrawingArea");

		// Remove the resize listener
		window.removeEventListener("resize", this.onResizeRescaleCanvas);
	}

	// Map panning or zooming
	onMapMovement(e) {
		const map = this.refs.map;

		// Send it up the chain
		this.props.onPanning({location: map.getLocation(), zoom: map.getZoom()})
	}

	// Line handling
	onLineDrawn(line){
		console.log("Line Drawn!");
		console.log(line);
	}

	// Window resizing (rescale canvas)
	onResizeRescaleCanvas(){
		// Update the state (which propagates to the canvas)
		const {width, height} = this.refs.drawing;
		this.setState({
			width: width,
			height: height
		});
	}
  
  	// The actual render function
	render() {
		return (
			<div ref="container" id="mapWrapper">
				if(this.props.drawing) {
					<CanvasDrawing height={this.state.height} width={this.state.width} onLineDrawn={this.onLineDrawn} />
				}
				<Map ref="map"}
					center={this.props.presetView.coordinates}
					zoom={this.props.presetView.zoom}
					onZoomend={this.onMapMovement}
					onMoveend={this.onMapMovement}>
					// Add all of the polylines to the map
					{this.props.lines.map((line) =>
						<Polyline color="lime" positions={line} />)}
					
					// Add the visible terrain layer
					<TileLayer
						attribution=''
						url={MAP_URL_TERRAIN}
						minZoom={1}
						maxZoom={18}
						accessToken={MAP_ACCESS_TOKEN}
						/>

					// Add the jank hidden layer used to get elevations from coordinates
					<TileLayer
						attribution=''
						url={MAP_URL_RGB_ELEVATION}
						maxNativeZoom={14}
						opacity={0.0}
						accessToken={MAP_ACCESS_TOKEN}
						/>
				</Map>
			</div>
		);
	}
}