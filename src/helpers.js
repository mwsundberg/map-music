// Scale the length of an array with linear interpolation
export function resizeArray(data, newLength) {
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

// A pseudo-vector pseudo-point object type
export class Coords {
	constructor(x, y) {
		this.x = x;
		this.y = y;

		// Properties
		this.magnitude = Math.sqrt(x**2 + y**2);

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
		return Math.sqrt((this.x - other.x)**2 + (this.y - other.y)**2);
	}
	normalized() {
		return new Coords(this.x/this.magnitude, this.y/this.magnitude);
	}
}