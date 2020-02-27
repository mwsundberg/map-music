import React from 'react';
import {Coords} from './helpers';

const DRAFTING_LINE_COLOR = "#525442";
const DRAWING_RESOLUTION = 2;
export default class CanvasDrawing extends React.Component {
	constructor(props){
		super(props);

		// Setup state
		this.state = {
			painting: false,
			lastPoint: null,
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
		// Get the current location from the event
		console.log("bitch?");
		const mouse = new Coords(e.offsetX, e.offsetY);

		// Start drawing
		this.ctx.beginPath();
		this.ctx.moveTo(mouse.x, mouse.y);

		// Update state
		this.setState(state => {
			return {
				painting: true,
				lastPoint: mouse,
				points: state.points.push(mouse)
			};
		})
	}

	// While drawing interpolate points to have evenly spaced coordinates
	onCanvasActivelyDrawing(e){
		// Do nothing when not painting
		if(!this.state.painting){
			return;
		}

		// Get the current location from the event
		const mouse = new Coords(e.offsetX, e.offsetY);

		// Calculate the vector from the previous point to the mouse location (since want to have evenly spaced points)
		console.log("idk bruh")
		const direction = (mouse.minus(this.state.lastPoint)).normalized();
		const deltaStep = direction.scaled(DRAWING_RESOLUTION);
		console.log("Bitch please")

		// If greater than the distance criteria, draw set length lines towards current mouse location until too close
		while(mouse.distanceTo(this.state.lastPoint) >= DRAWING_RESOLUTION){
			console.log("Distance to: " + mouse.distanceTo(this.state.lastPoint));

			// Calculate a new point DRAWING_RESOLUTION closer to the mouse location
			const newPoint = this.state.lastPoint.plus(deltaStep);

			// Interpolate a point a step away from the last point
			this.setState({
				lastPoint: newPoint,
				points: state.points.push(newPoint)
			});
		}

		// Draw the line from the last left point to the "lastPoint", which is the one closest to the threshold
		this.ctx.lineTo(this.state.lastPoint.x, this.state.lastPoint.y);
		this.ctx.stroke();
	}

	// Call props.onLineDrawn when done and clear the screen
	onCanvasFinishedDrawing(e){
		// Get the current location from the event and the canvas size from the props
		const mouse = new Coords(e.offsetX, e.offsetY);
		const {height, width} = this.props;

		// End drawing
		this.ctx.lineTo(mouse.x, mouse.y);
		this.ctx.stroke();

		// Update state 
		this.setState(state => {
			return {points: state.points.push(mouse)};
		})

		// Scale the coordinates to 0-1 and pass it up to the listener
		const scaledLine = this.state.points.map((point) => {
			new Coords(point.x/width, point.y/height)
		});
		this.props.onLineDrawn(scaledLine);

		// Reset the state to be blank
		this.setState({
			painting: false,
			lastPoint: null,
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