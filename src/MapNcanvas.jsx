import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import {Map, TileLayer, PolyLine} from 'react-leaflet';
import L from 'leaflet';
import {resizeArray} from './helpers';
import {Selector, ButtonGroup} from './FormComponents';
import CanvasDrawing from './CanvasDrawing';

// The upper-right corner histogram of elevations (needs height and width updating on window refresh)
class Histogram extends Component {
	constructor(props){
		super(props);

		// Creating a reference to the 
		this.canvas = React.createRef();
	}
	render() {
		// Shorthand for various needed things
		const canvasWidth = props.width;
		const canvasHeight = props.height;
		const ctx = this.canvas.current.getContext('2d');

		// Rescale the array to be one entry per x pixel
		const resampledElevations = resizeArray(props.elevations, canvasWidth);

		// Draw all of the elevations in the array
		ctx.fillStyle = "#fff";
		resampledElevations.forEach((elevation, index) => {
			// Make a white rectangle offset to the index and scaled up to the proportional elevation height
			ctx.fillRect(index,
			             canvasHeight * (1 - elevation),
			             1,
			             canvasHeight * elevation);
		});
		return <canvas ref={this.canvas} width={this.props.width} height={this.props.height} />;
	}
}

// The map-drawing-canvas thing
const MAP_URL_TERRAIN = "https://api.mapbox.com/styles/v1/mwsundberg/ck26wfu0759jk1claf7a3bblm/tiles/{z}/{x}/{y}?access_token={accessToken}";
const MAP_URL_RGB_ELEVATION = "https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token={accessToken}";
const MAP_ACCESS_TOKEN = "pk.eyJ1IjoibXdzdW5kYmVyZyIsImEiOiJjazI4Z3lkcHkwb3pzM2RwYm44YW9nM2ZuIn0.EyqGj9GuiUpvoauajxVPgA";
class MapDrawingArea extends Component {
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
			<div id="mapWrapper">
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

// The map-drawing-canvas thing (yet with controls this time)
class MapDrawingWithControls extends Component {
	constructor(props) {
		super(props);
		this.state = {
			drawing: false,
			loadedMapView: null,
			mapViewPresetsArray: null
		};

		// Bind Listeners
		this.onLocationPresetSelection = this.onLocationPresetSelection.bind(this);
		this.onLocationPresetSave = this.onLocationPresetSave.bind(this);
	}

	// Handle mounting and unmounting (canvas click listeners?)
	componentDidMount() {
		console.log("Mounted MapDrawingArea");
	}

	componentWillUnmount() {
		console.log("Unmounting MapDrawingArea");
	}

	// When the saved location selector updates
	onLocationPresetSelection(location) {
		// Update state
		this.setState({
			loadedMapView: location
		})
	}

	// When saving the current location as a preset
	onLocationPresetSave() {
		console.log("Ah, fuck");
		//TODO Get the state of various things
		const newPreset = {name: "fuck", coordinates: [0, 0], zoom: 14};

		// Check that it's a valid preset addition (not empty name and not already named that)
		if(newPreset.name !== "" && this.state.mapViewPresetsArray.every((item) => {newPreset.name !== item.name})) {
			// Update the select list
			this.setState((state, props) => {
				loadedMapView: newPreset,
				mapViewPresetsArray: state.mapViewPresetsArray.append(newPreset)
			});
		} else {
			console.log("Trying to add an invalid location preset");
		}
	}
	render() {
		return (
			<div id="mapToolbar" class="containerPadded">
				Select mode:
				<ButtonGroup>
					<input type="radio" name="mode" id="panningMode" value="panning" autocomplete="off" checked={this.state.drawing}><label for="panningMode" class="radioButton">&#xf256; Panning</label>
					<input type="radio" name="mode" id="drawingMode" value="drawing" autocomplete="off" checked={!this.state.drawing}><label for="drawingMode" class="radioButton">&#xf1fc; Drawing</label>
				</ButtonGroup>
				&emsp;
				<Selector label="Load a location: " options={this.state.mapViewPresetsArray} selected={this.state.loadedMapView} onSelection={this.onLocationPresetSelection}/>
				&emsp;
				<label for="saveLocationName">Bookmark current location:</label>
				<input type="text" id="saveLocationName" name="saveLocationName" autocomplete="off" placeholder="Location Save Name">
				<Button onClick={this.onLocationPresetSave} label="Save" />
			</div>
			<MapDrawingArea height={100} width={100} presetView={this.state.loadedMapView} drawing={this.state.drawing} />
		);
	}
}