import React, {PureComponent} from 'react';
import {arrayResize, arrayScaleToOne} from './helpers';

// The upper-right corner elevationProfile of elevations (needs height and width updating on window refresh)
export default class ElevationProfile extends PureComponent {
	// Do everything after the canvas is created
	componentDidMount(){
		// Load references to the canvas and dimensions
		const ctx = this.refs.canvas.getContext('2d');
		const {width, height} = this.props;

		// Rescale the array to be one entry per x pixel
		const resampledElevations = arrayResize(arrayScaleToOne(this.props.elevations), width);

		// Draw all of the elevations in the array
		ctx.fillStyle = "#fff";
		resampledElevations.forEach((elevation, index) => {
			// Make a white rectangle offset to the index and scaled up to the proportional elevation height
			ctx.fillRect(index,
			             height * (1 - elevation),
			             1,
			             height * elevation);
		});
	}

	render() {		
		return <canvas ref="canvas" width={this.props.width} height={this.props.height} />;
	}
}