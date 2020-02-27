import React from 'react';
import ReactDOM from 'react-dom';
import CanvasDrawing from './CanvasDrawing';
import {Selector} from './FormComponents';

// Test CanvasDrawing
// ReactDOM.render(
// 	<CanvasDrawing width={500} height={500} onLineDrawn={console.log}/>,
// 	document.getElementById('wholeUIContainer'));


// Test Form Selector
// <Selector label="Select Label: "
//		options={[{name: "something", etc:"etc"}, {name: "something2", etc:"etc"}]}
//		selected={{name: "something", etc:"etc"}}
//		onSelection={(selectedVal)={doSomething}} />
const options = [{name: "option1", value: "one"}, {name: "option2", value: "two"}];
ReactDOM.render(
	<Selector label="Select options" options={options} selected={options[0]} onSelection={console.log} />,
	document.getElementById('wholeUIContainer'));