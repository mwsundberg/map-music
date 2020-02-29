import React, {Component, PureComponent} from 'react';

// A dropdown selector option
// <Selector label="Select Label: "
//		options={[{name: "something", etc:"etc"}, {name: "something2", etc:"etc"}]}
//		selected={{name: "something", etc:"etc"}}
//		onSelection={(selectedVal)={doSomething}} />
export class Selector extends PureComponent {
	constructor(props){
		super(props);

		// Bind listeners
		this.handleChange = this.handleChange.bind(this);
	}

	// Update the internal values upon selection change
	handleChange(e){
		// Pass the value up through the listener
		this.props.onSelection(this.props.options[e.target.value]);
	}

	render() {
		// Short-reference the provided options
		const options = this.props.options;
		return (
			<label>{this.props.label}
				<select ref="selectRef" value={options.indexOf(this.props.selected)} onChange={this.handleChange}>
					{options.map((item, index) => 
						<option key={index} value={index}>{item.name}</option>
					)}
				</select>
			</label>
		);
	}
}

// Syntactic sugar for button groups
export const ButtonGroup = (props) => {
	return(
		<div className="buttonGroup" {...props}>
			{props.children}
		</div>
	);
};

// Standard issue button
export const Button = (props) => {
	return <input type="button" onClick={props.onClick} value={props.label}/>;
};