import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import L, {Map, TileLayer, PolyLine} from 'react-leaflet';
import {resizeArray} from './helpers';
import {Selector} from './FormComponents';

// The upper-right corner histogram of elevations
class Histogram extends Component {
	componentDidMount() {
		const canvas = this.refs.canvas;

		// Context is a static reference, updated in render?
		this.ctx = canvas.getContext("2d");
		
		this.updateCanvas();
	}

	updateCanvas() {
		// Rescale the array to be one entry per x pixel
		const resampledElevations = resizeArray(this.props.elevations, this.props.width);

		// Draw all of the elevations in the array
		this.ctx.fillStyle = "#fff";
		resampledElevations.forEach((height, index) => {
			// Make a white rectangle offset to the index and scaled up to the proportional elevation height
			this.ctx.fillRect(index,
			                  this.props.height * (1 - height),
			                  1,
			                  this.props.height * height);
		});
	}

	render() {
		return <canvas ref="canvas" width={this.props.width} height={this.props.height} />;
	}
}

// Standard issue button in the app
class Button extends Component {
	render() {
		return <input type="button" id={this.props.id} value={this.props.value}/>;
	}
}

// The map-drawing-canvas thing
const MAP_URL_TERRAIN = "https://api.mapbox.com/styles/v1/mwsundberg/ck26wfu0759jk1claf7a3bblm/tiles/{z}/{x}/{y}?access_token={accessToken}";
const MAP_URL_RGB_ELEVATION = "https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token={accessToken}";
const MAP_ACCESS_TOKEN = "pk.eyJ1IjoibXdzdW5kYmVyZyIsImEiOiJjazI4Z3lkcHkwb3pzM2RwYm44YW9nM2ZuIn0.EyqGj9GuiUpvoauajxVPgA";
class MapDrawingArea extends Component<{}> {
	constructor(props) {
		super(props);

		this.state = {
			center: this.props.center,
			zoom: this.props.zoom,
			painting: false
		}

		// Bind listeners
		this.onZoomEnd = this.onZoomEnd.bind(this);
		this.onMoveEnd = this.onMoveEnd.bind(this);
		this.onCanvasStartDrawing = this.onCanvasStartDrawing.bind(this);
		this.onCanvasActivelyDrawing = this.onCanvasActivelyDrawing.bind(this);
		this.onCanvasFinishedDrawing = this.onCanvasFinishedDrawing.bind(this);
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

	// Helper
	convertTouchEventToMouse(e){
		const touch = e.targetTouches[0];
		const bounds = this.canvas.getBoundingClientRect();
		return {
			offsetX: touch.clientX - bounds.x, 
			offsetY: touch.clientY - bounds.y};
	}

	// Drawing
	onCanvasStartDrawing(e) {
		const ctx = this.canvas.getContext("2d");
		// Set painting variables
		this.setState({painting: true});
		const mouseLocation = L.point(e.offsetX, e.offsetY);

		// Clear the old path
		if(stagedPath && !pathsList.includes(stagedPath)){
			stagedPath.removeFrom(this.map);
		}

		// Start drawing a line
		lineCoordinates.push(mouseLocation);
		ctx.strokeStyle = draftingLineColor;
		ctx.lineJoin = "round";
		ctx.lineCap = "round";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(mouseLocation.x, mouseLocation.y);
	}

	onCanvasActivelyDrawing(e){
		const ctx = this.canvas.getContext("2d");
		if(this.state.painting) {
	        let mouseLocation = L.point(e.offsetX, e.offsetY);

			// Get the direction of the mouse movement (for use with: https://math.stackexchange.com/a/175906)
			let v = mouseLocation.subtract(lineCoordinates[lineCoordinates.length - 1]);
			let du = v.divideBy(v.distanceTo(L.point(0,0))).multiplyBy(rawDistanceThreshold);

			// If greater than the distance criteria, draw set length lines towards current mouse location until too close
			while(mouseLocation.distanceTo(lineCoordinates[lineCoordinates.length - 1]) >= rawDistanceThreshold){
				// Interpolate a point rawDistanceThreshold units away from the last point (final bit of: https://math.stackexchange.com/a/175906)
				let interpolatedPoint = du.add(lineCoordinates[lineCoordinates.length - 1]);

				// Add the interpolated point to the list
				lineCoordinates.push(interpolatedPoint);

				// Draw the next line segment
				ctx.lineTo(interpolatedPoint.x, interpolatedPoint.y);
				ctx.stroke();
			}
		}
	}

	onCanvasFinishedDrawing() {
		// Check if there are enough points to do audio stuff
		if(lineCoordinates.length >= 2) {
			// Set up the new path
			let coordinates = lineCoordinates.map((point) => {
				// Get lat and long
				let coords = mymap.containerPointToLatLng(point);

				// Get altitude
				let color = elevationData.getColor(coords);
				if (color !== null) {
					// Convert the RGB channels to one hex number then scale to mapbox elevation data
					coords.alt = -10000 + 0.1 * ((color[0] << 16) + (color[1] << 8) + color[2]);
				} else {
					console.log("crap, coordinates at " + point + " aren't color-elevation-readable.");
				}

				// return the coordinates
				return coords;
			});

			// Make a new path object and graph it, add it to the map
			stagedPath = new Path(coordinates);
			stagedPath.renderHistogram(elevationHistogramCanvas, true);
			stagedPath.addTo(mymap);
			elevationDataDispatch(stagedPath);
		}

		// Reset canvas painting stuff
		mapCanvasContext.closePath();
		mapCanvasContext.clearRect(0, 0, mapCanvasContext.canvas.width, mapCanvasContext.canvas.height); // Clears the canvas
		painting = false;
		lineCoordinates = [];
	};
  
  	// The actual render function
	render() {
		return (
			<div id="mapWrapper">
				if(this.props.drawing) {
					<canvas className="drawingLayer"
						ref={c => {this.canvas = c;}}
						height={this.props.height}
						width={this.props.width})
						// Listeners for touch and all
						onMouseDown={this.onCanvasStartDrawing}
						onTouchStart={(e) => this.onCanvasStartDrawing(convertTouchEventToMouse(e))}
						onMouseMove={this.onCanvasActivelyDrawing}
						onTouchMove={(e) => this.onCanvasActivelyDrawing(convertTouchEventToMouse(e))}
						onMouseUp={this.onCanvasFinishedDrawing}
						onTouchEnd={this.onCanvasFinishedDrawing}>
					</canvas>
				}
				<Map ref={m => { this.map = m.leafletElement;}}
					center={this.props.center}
					zoom={this.props.zoom}
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
			loadedLocation: null,
			loadedZoom: null
		};
	}

	// Handle mounting and unmounting (canvas click listeners?)
	componentDidMount() {
		console.log("Mounted MapDrawingArea");
	}

	componentWillUnmount() {
		console.log("Unmounting MapDrawingArea");
	}

	render() {
		return (
			<div id="mapToolbar" class="containerPadded">
				Select mode:
				<div class="buttonGroup">
				    <input type="radio" name="mode" id="panningMode" value="panning" autocomplete="off" checked><label for="panningMode" class="radioButton">&#xf256; Panning</label>
				    <input type="radio" name="mode" id="drawingMode" value="drawing" autocomplete="off"><label for="drawingMode" class="radioButton">&#xf1fc; Drawing</label>
				</div>
				&emsp;
				<label for="locationSelect">Load a location:</label>
				<select id="locationSelect" name="locationSelect" autocomplete="off">
				</select>
				&emsp;
				<label for="saveLocationName">Bookmark current location:</label>
				<input type="text" id="saveLocationName" name="saveLocationName" autocomplete="off" placeholder="Location Save Name">
				<input type="button" name="saveLocationButton" value="Save">
			</div>
			<MapDrawingArea height={100} width={100} center={this.state.loadedLocation} zoom={this.state.loadedZoom} drawing={this.state.drawing} />
		);
	}
}



ReactDOM.render(
	<Histogram width={120} height={150} elevations={[0, 0.1, 0.2, 0.15, 0.9, 1]}/>,
	document.getElementById('wholeUIContainer'));

exports.success = success;