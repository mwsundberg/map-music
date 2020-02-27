import React, {Component} from 'react';
import {Coords} from './helpers';

const DRAFTING_LINE_COLOR = "#525442";
const DRAWING_RESOLUTION = 2;
export default class CanvasDrawing extends Component {
	constructor(props){
		super(props);

		// Setup state
		this.state = {
			painting: false,
			points: []
		}

		// Set listeners
		this.onCanvasStartDrawing = this.onCanvasStartDrawing.bind(this);
		this.onCanvasActivelyDrawing = this.onCanvasActivelyDrawing.bind(this);
		this.onCanvasFinishedDrawing = this.onCanvasFinishedDrawing.bind(this);
	}

	// Populate the canvas context reference and set styles
	componentDidMount(){
		this.ctx = this.refs.canvas.getContext('2d');
		this.ctx.strokeStyle = DRAFTING_LINE_COLOR;
		this.ctx.lineJoin = "round";
		this.ctx.lineCap = "round";
		this.ctx.lineWidth = 1;
	}


	// Setting up from first click
	onCanvasStartDrawing(e) {
		// Only start drawing when the primary button is clicked
		if(e.buttons != 1){
			return;
		}

		// Get the current location from the event (the real one, not the fake one)
		const mouse = new Coords(e.nativeEvent.offsetX, e.nativeEvent.offsetY);

		// Start drawing
		this.ctx.beginPath();
		this.ctx.moveTo(mouse.x, mouse.y);

		// Update state
		this.setState({
				painting: true,
				points: [mouse]
		});
	}

	// While drawing interpolate points to have evenly spaced coordinates
	onCanvasActivelyDrawing(e){
		// If click drag somehow is entering the canvas, initialize things
		if(!this.state.painting && e.buttons == 1){
			this.onCanvasStartDrawing(e);
			return;
		}

		// If the drag enters the canvas and is not still drawing, don't keep drawing
		if(this.state.painting && e.buttons != 1){
			this.onCanvasFinishedDrawing(e);
			return;
		}

		// Do nothing when not painting
		if(!this.state.painting){
			return;
		}

		// Get the current location from the event (the real one, not the fake one), and the previous one from state
		const mouse = new Coords(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
		const lastPoint = this.state.points[this.state.points.length - 1];

		// Calculate the vector from the previous point to the mouse location (since want to have evenly spaced points)
		const direction = (mouse.minus(lastPoint)).normalized();
		const deltaStep = direction.scaled(DRAWING_RESOLUTION);

		// If greater than the distance criteria, draw set length lines towards current mouse location until too close
		let pointsToAdd = [lastPoint];
		for(let point = pointsToAdd[0]; mouse.distanceTo(point) >= DRAWING_RESOLUTION; point = pointsToAdd[pointsToAdd.length - 1]){
			// Calculate a new point DRAWING_RESOLUTION closer to the mouse location
			const newPoint = point.plus(deltaStep);
			pointsToAdd.push(newPoint);
		}

		// Get the state in line, removing the already included lastPoint then adding it
		pointsToAdd.shift()
		this.setState((state, props) =>{
			// Do the deed here:
			state.points.push(...pointsToAdd);
			return {
				// Update it here (since push is a bitch)
				points: state.points
			};
		});

		// Draw the line from the last left point to the "lastPoint", which is the one closest to the threshold
		this.ctx.lineTo(lastPoint.x, lastPoint.y);
		this.ctx.stroke();
	}

	// Call props.onLineDrawn when done and clear the screen
	onCanvasFinishedDrawing(e){
		// Extract the height and width from the properties
		const {width, height} = this.props;

		// Scale the coordinates to 0-1 and pass it up to the listener
		const scaledLine = this.state.points.map((point) => {
			return new Coords(point.x/width, point.y/height);
		});
		this.props.onLineDrawn(scaledLine);

		// Reset the state to be blank
		this.setState({
			painting: false,
			points: []
		});

		// Clear the screen
		this.ctx.clearRect(0, 0, width, height);
	}

	render() {
		return (
			<canvas
				ref="canvas"
				height={this.props.height}
				width={this.props.width}
				// Listeners for mouse only (touch later)
				onMouseDown={this.onCanvasStartDrawing}
				onMouseMove={this.onCanvasActivelyDrawing}
				onMouseUp={this.onCanvasFinishedDrawing}
			/>
		);
	}
}