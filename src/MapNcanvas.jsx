import React from 'react';
let name = "Matthew";
class Canvas extends React.Component {
	this.width = 120;
	this.height = 120;
	componentDidMount() {
		const canvas = this.refs.canvas;
		const ctx = canvas.getContext("2d");

		// Draw shit here
		ctx.fillStyle = "#aff";
		ctx.fillRect(0, 0, 100, 100);
	}

	render() {
		return(
			<div>
				<canvas ref="canvas" width={this.width} height={this.height} />
			</div>
			)
	}
}
ReactDOM.render(
  element,
  document.getElementById('root')
);

exports.success = success;