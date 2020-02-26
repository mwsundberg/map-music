export function resizeArray(data, newLength) {
	console.log("fucking shit up yeet");
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