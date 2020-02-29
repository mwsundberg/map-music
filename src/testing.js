import React from 'react';
import ReactDOM from 'react-dom';
import CanvasDrawing from './CanvasDrawing';
import {Selector} from './FormComponents';
import ElevationProfile from './ElevationProfile';

// Test CanvasDrawing
// ReactDOM.render(
// 	<CanvasDrawing width={500} height={500} onLineDrawn={console.log}/>,
// 	document.getElementById('wholeUIContainer'));


// Test Form Selector
// const options = [{name: "option1", value: "one"}, {name: "option2", value: "two"}];
// ReactDOM.render(
// 	<Selector label="Select options " options={options} selected={options[0]} onSelection={console.log} />,
// 	document.getElementById('wholeUIContainer'));

// Test Histogram
const elevations = [1, 2, 5, 3, 2, 1, 5];
ReactDOM.render(
	<ElevationProfile width={200} height={200} elevations={elevations}/>,
	document.getElementById('wholeUIContainer'));

