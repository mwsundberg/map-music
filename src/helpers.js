// Scale the length of an array with linear interpolation
export function arrayResize(data, newLength) {
	let indexScalar = (data.length - 1) / (newLength - 1);
	let resultData = [];

	// Set the first value to be the same
	resultData[0] = data[0];

	// For each new index
	for (let i = 1; i < newLength - 1; i++) {
		// Figure out how far through the original data it is (and which two datapoints are on either side of it)
		let howFar = i * indexScalar;
		let beforeIndex = Math.floor(howFar);
		let afterIndex = Math.ceil(howFar);

		// Save the value interpolated that far in ()
		resultData[i] = ((before, after, atPoint) => {
			return before + (after - before) * atPoint;
		})(data[beforeIndex], data[afterIndex], howFar - beforeIndex);
	}

	// Set the last value to be the same
	resultData[newLength - 1] = data[data.length - 1];

	return resultData;
}

// Scale the values of a numeric array to a 0-1 scale
export function arrayScaleToOne(data) {
	const min = Math.min(...data);
	const range = Math.max(...data) - min;
	return data.map(value => ((value - min) / range));
}

// A pseudo-vector pseudo-point object type
export class Coords {
	constructor(x, y) {
		this.x = x;
		this.y = y;

		// Properties
		this.magnitude = this.distanceTo({x: 0, y: 0});

		// Function bindings
		this.scaled = this.scaled.bind(this);
		this.plus = this.plus.bind(this);
		this.minus = this.minus.bind(this);
		this.distanceTo = this.distanceTo.bind(this);
		this.normalized = this.normalized.bind(this);
	}

	// All methods return a new value and do not mutate state
	scaled(scalar) {
		return new Coords(this.x*scalar, this.y*scalar);
	}
	plus(other) {
		return new Coords(this.x+other.x, this.y+other.y);
	}
	minus(other) {
		return new Coords(this.x-other.x, this.y-other.y);
	}
	distanceTo(other) {
		return Math.sqrt((this.x - other.x)**2 + (this.y - other.y)**2)
	}
	normalized() {
		return this.scaled(1 / this.magnitude);
	}
}