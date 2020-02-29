import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import {Map, TileLayer, PolyLine} from 'react-leaflet';
import L from 'leaflet';
import {resizeArray} from './helpers';
import {Selector, ButtonGroup} from './FormComponents';


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