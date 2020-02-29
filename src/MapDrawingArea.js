import React, {Component} from 'react';
import CanvasDrawing from './CanvasDrawing';

// The map-drawing-canvas thing
const MAP_URL_TERRAIN = "https://api.mapbox.com/styles/v1/mwsundberg/ck26wfu0759jk1claf7a3bblm/tiles/{z}/{x}/{y}?access_token={accessToken}";
const MAP_URL_RGB_ELEVATION = "https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token={accessToken}";
const MAP_ACCESS_TOKEN = "pk.eyJ1IjoibXdzdW5kYmVyZyIsImEiOiJjazI4Z3lkcHkwb3pzM2RwYm44YW9nM2ZuIn0.EyqGj9GuiUpvoauajxVPgA";
export default class MapDrawingArea extends Component {
	constructor(props) {
		super(props);

		this.state = {
			center: this.props.presetView.coordinates,
			zoom: this.props.presetView.zoom,
			painting: false
		}

		// Bind listeners
		this.onZoomEnd = this.onZoomEnd.bind(this);
		this.onMoveEnd = this.onMoveEnd.bind(this);
		this.onLineDrawn = this.onLineDrawn.bind(this);
	}

	// Handle mounting and unmounting (canvas click listeners?)
	componentDidMount() {
		console.log("Mounted MapDrawingArea");

		// Set a window resize listener to update canvas size
		this.resizeListener = window.addListener("resize", this.onResize);
	}

	componentWillUnmount() {
		console.log("Unmounting MapDrawingArea");

	}

	// Map zooming
	onZoomEnd(e) {
		// Update state
		this.setState({
			zoom: this.map.getZoom()
		});
	}

	// Map panning
	onMoveEnd(e) {
		// Update state
		this.setState({
			center: this.map.getLocation()
		})
	}

	onLineDrawn(line){
		console.log("Line Drawn!");
		console.log(line);
	}
  
  	// The actual render function
	render() {
		return (
			<div ref="mapWrapper">
				if(this.props.drawing) {
					<CanvasDrawing height={200} width={200} onLineDrawn={this.onLineDrawn} />
				}
				<Map ref={m => { this.map = m.leafletElement;}}
					center={this.props.presetView.coordinates}
					zoom={this.props.presetView.zoom}
					onZoomend={this.onZoomEnd}
					onMoveend={this.handleMoveEnd}>
					<TileLayer
						attribution=''
						url={MAP_URL_TERRAIN}
						minZoom={1}
						maxZoom={18}
						accessToken={MAP_ACCESS_TOKEN}
						/>
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