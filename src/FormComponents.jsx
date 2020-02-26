
// A dropdown selector option
// <Selector label={"Select Label: "}
//		options={[{name: "something", etc:"etc"}, {name: "something2", etc:"etc"}]}
//		selected={{name: "something", etc:"etc"}}
//		onSelection={(selectedVal)={doSomething}} />
export class Selector extends Component {
	constructor(props){
		super(props);

		// Initialize the state with the index of the provided object
		this.state = {
			valueIndex: props.options.indexOf(this.props.selected)
		}

		// Bind listeners
		this.handleChange = this.handleChange.bind(this);
	}

	// Update the internal values upon selection change
	handleChange(e){
		// Update the value of the select
		this.setState({
			valueIndex: e.target.value
		});

		// Pass the value up through the listener
		this.props.onSelection(props.options[e.target.value]);
	}

	render() {
		// Short-reference the provided options
		const options = this.props.options;
		return (
			<label>{this.props.label}
				<select ref="selectRef" value={this.state.valueIndex} onChange={this.handleChange}>
					{options.map((item, index) => {
						<option key={index} value={index}>{item.name}</option>
					})}
				</select>
			</label>
			);
	}
}
