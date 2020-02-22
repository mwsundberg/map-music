import React from 'react';
import ReactDOM from 'react-dom';
import {resizeArray} from './helpers';

class Histogram extends React.Component {
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
			// Make a white rectangle from 
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
ReactDOM.render(
	<Histogram width={120} height={150} elevations={[0, 0.1, 0.2, 0.15, 0.9, 1]}/>,
	document.getElementById('wholeUIContainer'));

exports.success = success;